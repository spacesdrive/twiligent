# Data Flow - Comment-to-DM Automation

## Overview

An account owner writes a rule: keywords, which posts it covers, and a reply with an optional link. When someone comments one of the keywords on a post or reel of a connected Instagram professional account, Meta sends the comment to the Worker's webhook, and the Worker sends the commenter a private reply through Instagram's messages endpoint.

```
Instagram comment
  -> Meta comments webhook        POST /api/webhooks/instagram (signed with X-Hub-Signature-256)
  -> verifyMetaWebhook            1 MB limit, HMAC-SHA256 over the raw body with the app secret
  -> parseInstagramWebhook        comments changes only; anything else is counted and dropped
  -> automationWebhook.ingest     rules for the Instagram account -> match -> store every comment (dedupe)
  -> 200 {"success":true}         only after the comments are stored; a failure answers 5xx and Meta retries for 36 hours
  -> waitUntil: automationProcessor.run({ ids })   the new matched comments, after the response
       claim -> check -> reserve within limits -> POST /<ig-id>/messages -> finish
  -> every 5 minutes: automationProcessor.run()     retries, waits, recovery
```

The database is the queue: a matched comment's row in `automation_comments` is the job that sends its reply. There is no Cloudflare Queue (ADR-040).

## What Instagram Allows

Checked against Meta's documentation on 2026-10-16:

| Rule | Value | Source |
|---|---|---|
| API setup | Instagram API with Instagram Login (`graph.instagram.com`), the setup Twiligent already connects with | Instagram Platform overview |
| Permissions | `instagram_business_basic`, `instagram_business_manage_comments` (comments webhook and private replies), `instagram_business_manage_messages`; Twiligent's OAuth already asks for all three | Private replies, webhook fields |
| Access level | Advanced Access for the `comments` webhook field; Business verification for production; the app must be Live | Webhooks setup |
| Accounts | Professional (Business or Creator) accounts only; the account must be public, since private accounts get no comment notifications | Webhooks setup |
| Replies per comment | One private reply; a follow-up only after the person replies, within 24 hours | Private replies |
| Reply window | 7 days after the comment (Live comments: only during the broadcast, not supported here) | Private replies |
| Rate limit | 750 private replies an hour per professional account for posts and reels | Graph API rate limiting, Business Use Case limits |
| Message size | Text up to 1,000 bytes | Messaging API |
| Webhook retries | Retried with decreasing frequency for 36 hours until a 200; duplicates must be handled | Webhooks setup |

The general Instagram Platform call quota is a different limit from the 750 private replies an hour, and neither is a daily DM allowance. Twiligent's own limits stay below them and are configurable.

## Setup: Getting Comments to the Worker

1. **The app-level webhook** (Meta dashboard, Instagram, API setup with Instagram login, Configure webhooks): callback URL `https://<worker>/api/webhooks/instagram`, the Verify Token from `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, and the `comments` field. Meta checks the URL with `GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`; `automationWebhook.challengeAnswer()` compares the token in constant time and answers the bare challenge.
2. **The account-level subscription**: Instagram sends an account's comments only after `POST /<ig-id>/subscribed_apps?subscribed_fields=comments` with that account's token. Twiligent calls it when a rule is first turned on for the account, and from the "Turn on comment events" button (`POST /api/automations/accounts/:accountId/subscribe`). The time is kept in `automation_accounts.subscribed_at`. If Instagram refuses, the rule is still saved and the page shows the account as not receiving comments.

Signatures: Instagram Login apps sign with the Instagram app secret (`INSTAGRAM_APP_SECRET`). `META_APP_SECRET`, the Meta app's own secret, is accepted as a second key because the dashboard shows both and developers report each in use.

## Intake: `POST /api/webhooks/instagram`

1. `verifyMetaWebhook` refuses a body over 1 MB, reads the raw bytes, and checks `X-Hub-Signature-256` against each configured secret with `crypto.subtle.verify` (constant time). No secret configured answers 503; a bad signature 401, before any database work.
2. `parseInstagramWebhook` refuses a body whose `object` is not `instagram` (400). Inside it, each `comments` change becomes an event (comment id from `id` or `comment_id`, author, text, media, the entry's account id and `time`); other fields and malformed changes are counted as unsupported and dropped.
3. `automationWebhook.ingest()` groups the events by Instagram account id and calls `automation_rules_for_ig_user` once per account: the enabled rules of every connected Twiligent account with that `igUserId`, oldest account first. An account with no enabled rule stores nothing.
4. Each comment is classified:
   - the account's own comment: `ignored`, reason `own_comment`
   - no text: `ignored`, `no_text`
   - no rule matches: `ignored`, `no_match`, stored without its text or author
   - a match: `queued`, with the rule, the author and the text (at most 2,200 characters)
5. `insertMany()` upserts all of them with `ignoreDuplicates` on the unique `(ig_user_id, comment_id)`, so a notification Meta delivers again inserts nothing; only the new rows come back.
6. The controller answers `200 {"success":true}` and hands the new queued ids to `inBackground()`, which builds services with their own 25 second deadline (the request's signal ends with the response) and runs `automationProcessor.run({ ids })` under `ctx.waitUntil()`.

If storing fails, the request fails with 5xx, and Meta delivers the notification again later. Nothing is acknowledged that is not stored.

`expires_at` is the notification time plus 7 days. Meta's payload has no comment time, and a redelivered notification carries a later time, so the window can be a little generous; a reply sent after Instagram's window is refused there and recorded as failed.

## Matching (`backend/lib/automationMatching.ts`)

- Text is normalised with NFKC (full-width letters fold to plain ones) and runs of spaces collapse; matching ignores case unless the rule says otherwise.
- `contains`: the keyword appears as whole words (a letter or digit on either side breaks the match, so GUIDE never matches GUIDELINES). Phrases work across spaces; regular expression characters are literal.
- `exact`: the whole comment equals the keyword once spaces, punctuation and emoji at its edges are removed.
- A rule covers every post when `media_ids` is empty, or only the listed posts. Rules for the comment's post are tried before rules for every post, then oldest first; the first match wins. A comment never triggers a rule meant for another post.
- `POST /api/automations/test` runs the same matching on a sample comment and returns the composed reply; it stores and sends nothing.

## Delivery (`backend/services/automationProcessor.ts`)

`run({ ids?, limit? })` returns at once when `AUTOMATION_PAUSED` is true. Otherwise it claims up to the batch size and settles each job in turn, so each account's replies keep their order and the run never opens more than one connection to Instagram at a time:

1. **Claim** (`claim_automation_comments`): due jobs (`queued` or `retry_wait` with `next_attempt_at <= now`) and jobs whose run stopped (`processing` for more than 20 minutes), oldest first, at most `perAccount` per account, locked with `FOR UPDATE SKIP LOCKED` so two runs never take the same job. The same call turns any `sending` job older than 20 minutes into `needs_review`. It returns the rule's reply and the account's token with each job.
2. **Check** (`readinessPlan`): an expired comment becomes `expired`, a rule that was turned off or removed `skipped`, an account without a token `failed`. No limit is spent on these.
3. **Reserve** (`reserve_automation_send`): one transaction under an advisory lock, so every Worker sees the same counts and two jobs cannot both take the last free send. In order: a paused account holds the job; an account cooldown waits for it; the commenter already got the daily number of replies from this account (counting other comments, not retries of this one) skips it; then the rule's, account's, user's and instance's hourly limits. When a scope is full, the job waits until the oldest send in that hour is an hour old. On success the job becomes `sending`, its attempts count goes up, and an `automation_attempts` row records the request before it leaves.
4. **Send** (`sendPrivateReply`): `POST https://graph.instagram.com/v25.0/<ig-id>/messages` with `{ recipient: { comment_id }, message: { text } }` and the account's token as a Bearer header, 10 second timeout, never repeated inside the call.
5. **Finish** (`finish_automation_send`): records the outcome on the attempt and the comment in one transaction, and sets a cooldown or a hold on the account when the answer calls for one.

A database error on one job is logged and the run moves on; that job's claim or reservation expires and the recovery above picks it up.

### What each answer does

| Instagram's answer | Comment | Attempt | Account |
|---|---|---|---|
| 200 with `message_id` | `accepted`, `message_id` kept | `accepted` | |
| Codes 4, 17, 32, 613, 80002, 80006 or HTTP 429 | `retry_wait` until the cooldown ends | `rate_limited` | cooldown from `X-Business-Use-Case-Usage` (`estimated_time_to_regain_access`), else 15 minutes |
| Code 368 (temporarily blocked) | `retry_wait` | `rejected` | 24 hour cooldown |
| Codes 1, 2 or HTTP 5xx | `retry_wait` after 1, 2, 4, 8 minutes (at most an hour) plus up to 30 seconds; `failed` after 5 tries | `rejected` | |
| Code 10900 or subcode 2534023 (already replied) | `skipped` | `rejected` | |
| Codes 3, 190, 200, a bare 10, subcode 2534041 (token or permission) | back to `queued`, held | `rejected` | paused with the reason: reconnect, then resume |
| Code 551, 10903; subcodes 2534014, 2534022, 2534025, 2018001 (not allowed for this comment) | `failed` | `rejected` | |
| Any other error | `failed`, with Instagram's message | `rejected` | |
| Timeout, connection lost, unreadable 200 | `needs_review` | `ambiguous` | |
| The Worker refused the request (subrequest limit) | `retry_wait`, 5 minutes | `rejected` | |

A wait that would end after the 7 day window makes the comment `expired` instead.

## Duplicates and Ambiguity

- A notification Meta delivers twice is stored once: `unique (ig_user_id, comment_id)`.
- A comment repeated inside one notification is stored once.
- Two runs never send the same job: the claim locks rows, and the reservation only moves a job this run holds.
- A job whose run stopped before the request left is claimed again after its 20 minute lease.
- A send that may have reached Instagram (timeout, lost connection, a run that stopped while `sending`) is never retried on its own. It shows as Needs review, and the owner decides after checking the conversation on Instagram. If they retry and the first reply did arrive, Instagram refuses a second private reply to the same comment (10900), and the comment is marked skipped.
- Delivery is at least once into the queue and at most once to Instagram without a person's decision. Instagram reports acceptance, not delivery or reading, so the dashboard says "Accepted by Instagram" and never "Delivered".

## Comment Status Lifecycle

```
ignored                      (no rule matched; final)
queued -> processing -> sending -> accepted
   ^          |            |-> retry_wait -> processing ...
   |          |            |-> failed | skipped | expired
   |          |            '-> needs_review (no answer, or the run stopped)
   |          |-> queued (held: account paused) | retry_wait (limit, cooldown)
   |          '-> skipped (rule off, recipient limit) | expired | failed (no token)
   '-- retry by the owner (failed, skipped, needs_review, within 7 days)
```

| Status | Shown as | Meaning |
|---|---|---|
| `ignored` | No match | Received; no rule answers it |
| `queued` | Waiting, or Held | Waiting to send; Held when its account is paused |
| `processing`, `sending` | Sending | A run holds it |
| `retry_wait` | Trying again | Waiting for a retry, a cooldown or an hourly limit |
| `accepted` | Accepted by Instagram | Instagram took the reply |
| `failed` | Failed | Instagram refused it, or it failed 5 times |
| `needs_review` | Needs review | It may have been sent; check before retrying |
| `skipped` | Skipped | Rule off, recipient limit, or already answered |
| `expired` | Expired | The 7 days ran out first |

## Limits and Controls

| Scope | Default | Set with |
|---|---|---|
| Instance, per hour | 1,000 | `AUTOMATION_GLOBAL_HOURLY_LIMIT` |
| User, per hour | 500 | `AUTOMATION_USER_HOURLY_LIMIT` |
| Instagram account, per hour | 200 (Instagram allows 750) | `AUTOMATION_ACCOUNT_HOURLY_LIMIT`, at most 750 |
| Rule, per hour | none | the rule's hourly limit, 1 to 750 |
| Person, per day per account | 3 replies | `AUTOMATION_RECIPIENT_DAILY_LIMIT` |
| Replies per webhook request or sweep | 10 | `AUTOMATION_BATCH_SIZE`, at most 15 |

| Control | Effect |
|---|---|
| `AUTOMATION_PAUSED=true` | Nothing is sent on the instance; comments are still stored and matched |
| Pause an account (Replies switch) | Its replies are held and go out when resumed, within the 7 days |
| Turn a rule off | New comments stop matching it; its waiting replies are skipped |
| Retry an item | Puts a failed, skipped or review item back in the queue and starts it at once |

The batch cap of 15 comes from the Workers Free plan's 50 subrequests per invocation: each reply costs three (reserve, send, finish), plus the claim and the intake queries.

## Response Time

- Normally a few seconds: Meta delivers the webhook, the Worker stores it and sends the reply right after answering.
- Up to 5 minutes for a reply that waits for the sweep (more than the batch in one notification, or a webhook that stopped early), and up to 10 when a quarter-hour run also published posts.
- Longer only while a limit, a cooldown, a pause or Meta's own delivery delay holds it.

## Data Kept and Removed

| Data | Kept | Removed |
|---|---|---|
| Matched comments: text, author, status, reply id | 90 days | Daily retention; also when the account or user is removed |
| Unmatched comments | 90 days, without text or author | Same |
| Reply attempts | With their comment | With their comment |
| Rules, account controls | Until deleted | With the account |
| Audit events | 1 year | Daily retention; with the user |

Logs carry ids, statuses and error codes, never tokens, secrets or comment text.

## Costs

Everything runs on the existing Worker, Supabase project and Workers Free plan; nothing new is billed. Each comment costs one webhook request and, when matched, about four database calls and one Instagram request. The Workers Free plan allows 100,000 requests a day; webhook deliveries count against it, and the 288 five minute cron runs a day are a small share even counted as requests. Past the daily allowance the free plan refuses requests rather than billing them, and Meta retries a refused webhook for 36 hours. Cloudflare Queues, KV and D1 are not used. Recheck Cloudflare's and Supabase's pricing pages before relying on these numbers.

## Files

| Layer | File |
|---|---|
| Routes | `routes/instagramWebhookRoutes.ts` (public), `routes/automationRoutes.ts` |
| Middleware | `middleware/metaWebhook.ts` |
| Controllers | `controllers/instagramWebhookController.ts`, `controllers/automationController.ts`, `inBackground()` in `controllers/http.ts` |
| Validators | `validators/instagramWebhookValidators.ts`, `validators/automationValidators.ts` |
| Services | `services/automationWebhookService.ts`, `services/automationProcessor.ts`, `services/automationService.ts`, `services/retentionService.ts` |
| Platform | `services/instagram/instagramMessaging.ts` |
| Rules | `lib/automationMatching.ts`, `lib/automationDelivery.ts`, `lib/metaWebhookSignature.ts` |
| Repositories | `repositories/automationRuleRepository.ts`, `automationCommentRepository.ts`, `automationAccountRepository.ts`, `auditRepository.ts` |
| Database | `supabase/migrations/20261016100000` to `20261016101000` |
| App | `frontend/src/features/automations/` |
