# Data Flow - Comment-to-DM Automation

## Overview

An account owner writes a rule: keywords or any comment, which posts it covers, and a reply with an optional link. When someone comments on a post or reel of a connected Instagram professional account and a rule answers the comment, Meta sends the comment to the Worker's webhook, and the Worker sends the commenter a private reply through Instagram's messages endpoint. A followers-only rule first asks the person to follow and reply, and sends the link once Instagram confirms the follow.

```
Instagram comment                      Instagram message (followers-only rules only)
  -> Meta webhook                      POST /api/webhooks/instagram (signed with X-Hub-Signature-256)
  -> verifyMetaWebhook                 1 MB limit, HMAC-SHA256 over the raw body with the app secret
  -> parseInstagramWebhook             comments changes and messaging events; anything else is counted and dropped
  -> automationWebhook.ingest          rules for the account -> match -> store every comment (dedupe);
                                       messages from people a followers-only reply waits for -> follow-up jobs
  -> 200 {"success":true}              only after both are stored; a failure answers 5xx and Meta retries for 36 hours
  -> waitUntil: send the new replies, then the new follow-ups, after the response
       claim -> check -> reserve within limits -> POST /<ig-id>/messages -> finish
  -> every minute (* * * * *):         dispatch: due replies and follow-ups, recovery of stopped runs
  -> every 5 minutes, off the quarter: reconcile: expire overdue jobs, look for lost replies, report queue health
  -> daily (0 0 * * *):                token refresh, then retention in batches
```

The database is the queue: a matched comment's row in `automation_comments` is the job that sends its private reply, and a row in `automation_followups` is the job that answers a person's reply to a followers-only message. There is no Cloudflare Queue (ADR-040, ADR-043).

## What Instagram Allows

Checked against Meta's documentation on 2026-10-16:

| Rule | Value | Source |
|---|---|---|
| API setup | Instagram API with Instagram Login (`graph.instagram.com`), the setup Twiligent already connects with | Instagram Platform overview |
| Permissions | `instagram_business_basic`, `instagram_business_manage_comments` (comments webhook and private replies), `instagram_business_manage_messages` (messages webhook, follow-ups, follow checks, conversations); Twiligent's OAuth already asks for all three | Private replies, webhook fields, User Profile API |
| Access level | Advanced Access for the `comments` and `messages` webhook fields; Business verification for production; the app must be Live | Webhooks setup |
| Accounts | Professional (Business or Creator) accounts only; the account must be public, since private accounts get no comment notifications | Webhooks setup |
| Replies per comment | One private reply, text only in the documented request; a follow-up only after the person replies, within 24 hours | Private replies |
| Reply window | 7 days after the comment (Live comments: only during the broadcast, not supported here) | Private replies |
| Follow status | `is_user_follow_business` from the User Profile API, only after the person has sent the account a message (or tapped an icebreaker or persistent menu); before that Instagram answers "User consent is required to access user profile" | User Profile API |
| Private reply rate | 750 an hour per professional account for posts and reels | Messenger Platform rate limits |
| Send API rate | 300 calls a second per account for text and links (follow-ups) | Messenger Platform rate limits |
| Conversations API rate | 2 calls a second per account | Messenger Platform rate limits |
| Message size | Text up to 1,000 bytes | Messaging API |
| Webhook retries | Retried with decreasing frequency for 36 hours until a 200; duplicates must be handled | Webhooks setup |
| Webhook fields | Every field selected for the app reaches every connected account; fields cannot be chosen per account | Webhooks setup |

The general Instagram Platform call quota is a different limit from the 750 private replies an hour, and neither is a daily DM allowance. Twiligent's own limits stay below them and are configurable.

## Setup: Getting Comments and Messages to the Worker

1. **The app-level webhook** (Meta dashboard, Instagram, API setup with Instagram login, Configure webhooks): callback URL `https://<worker>/api/webhooks/instagram`, the Verify Token from `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, and the `comments` field. Followers-only rules also need the `messages` field. Meta checks the URL with `GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`; `automationWebhook.challengeAnswer()` compares the token in constant time and answers the bare challenge.
2. **The account-level subscription**: Instagram sends an account's events only after `POST /<ig-id>/subscribed_apps?subscribed_fields=...` with that account's token. Twiligent asks for `comments`, and for `comments,messages` while an enabled followers-only rule of the account exists. It subscribes when a rule is turned on or the followers-only option changes, and from the "Turn on comment events" or "Turn on message events" button (`POST /api/automations/accounts/:accountId/subscribe`). The time and the fields Instagram confirmed are kept in `automation_accounts.subscribed_at` and `subscribed_fields`. If Instagram refuses `messages`, Twiligent subscribes to `comments` alone and the account shows "Follow checks off". If Instagram refuses entirely, the rule is still saved and the page shows the account as not receiving comments.

Selecting `messages` in the Meta dashboard sends every direct message to every connected account to the Worker. Each one is a Worker request and one database call, so select it only when a followers-only rule is used.

Signatures: Instagram Login apps sign with the Instagram app secret (`INSTAGRAM_APP_SECRET`). `META_APP_SECRET`, the Meta app's own secret, is accepted as a second key because the dashboard shows both and developers report each in use.

## Intake: `POST /api/webhooks/instagram`

1. `verifyMetaWebhook` refuses a body over 1 MB, reads the raw bytes, and checks `X-Hub-Signature-256` against each configured secret with `crypto.subtle.verify` (constant time). No secret configured answers 503; a bad signature 401, before any database work.
2. `parseInstagramWebhook` refuses a body whose `object` is not `instagram` (400). Inside it:
   - each `comments` change becomes an event (comment id from `id` or `comment_id`, author, text, media, the entry's account id and `time`);
   - each `messaging` event with a `message` or a `postback` becomes a message event (sender, message id, the event's timestamp). Its text is never read. The account's own echoes, `is_self` test messages and deleted messages are skipped;
   - other fields and malformed entries are counted as unsupported and dropped.
3. `automationWebhook.ingest()` groups the comments by Instagram account id and calls `automation_rules_for_ig_user` once per account: the enabled rules of every connected Twiligent account with that `igUserId`, oldest account first. An account with no enabled rule stores nothing.
4. Each comment is classified:
   - the account's own comment: `ignored`, reason `own_comment`
   - no text: `ignored`, `no_text`
   - no rule answers it: `ignored`, `no_match`, stored without its text or author
   - a rule answers it: `queued`, with the rule, the author and the text (at most 2,200 characters)
5. `insertMany()` upserts all of them with `ignoreDuplicates` on the unique `(ig_user_id, comment_id)`, so a notification Meta delivers again inserts nothing; only the new rows come back.
6. Message events are grouped by account, and `automation_followups_for_messages` runs once per account. It makes a follow-up for a sender whose followers-only reply was accepted in the last 7 days and still waits for them (`gate_status = 'awaiting_reply'`, a minute of slack for the two clocks). A message Meta delivers again inserts nothing (`unique (ig_user_id, trigger_message_id)`), and a second message while a follow-up is open inserts nothing (one open follow-up per comment). Messages from anyone else are not kept.
7. The controller answers `200 {"success":true}` and hands the new reply ids, then the new follow-up ids, to `inBackground()`, which builds services with their own 25 second deadline (the request's signal ends with the response).

If storing fails, the request fails with 5xx, and Meta delivers the notification again later. Nothing is acknowledged that is not stored.

`expires_at` is the notification time plus 7 days. Meta's payload has no comment time, and a redelivered notification carries a later time, so the window can be a little generous; a reply sent after Instagram's window is refused there and recorded as failed.

## Matching (`backend/lib/automationMatching.ts`)

- Text is normalised with NFKC (full-width letters fold to plain ones) and runs of spaces collapse; matching ignores case unless the rule says otherwise.
- `contains`: the keyword appears as whole words (a letter or digit on either side breaks the match, so GUIDE never matches GUIDELINES). Phrases work across spaces; regular expression characters are literal.
- `exact`: the whole comment equals the keyword once spaces, punctuation and emoji at its edges are removed.
- `any`: every comment with text answers, emoji included. Such a rule has no keywords (`keywordsProblem` in `lib/automationRules.ts`, and a check constraint).
- A rule covers every post when `media_ids` is empty, or only the listed posts. A comment never triggers a rule meant for another post.
- When several rules could answer, the most specific one does: rules for this post before rules for every post, and in each group keyword rules before any-comment rules; then the oldest. One rule answers a comment, and a comment is one row, so a comment never gets two private replies.
- `POST /api/automations/test` runs the same matching on a sample comment and returns the composed first message; it stores and sends nothing.

## Delivery of Private Replies (`backend/services/automationProcessor.ts`)

`run({ ids?, limit?, subrequests?, timeBudgetMs? })` returns at once when `AUTOMATION_PAUSED` is true. Otherwise it claims up to the batch size and settles each job in turn, so each account's replies keep their order and the run never opens more than one connection to Instagram at a time. It reports the subrequests it used, so the dispatch can give the rest to follow-ups.

1. **Claim** (`claim_automation_comments`): due jobs (`queued` or `retry_wait` with `next_attempt_at <= now`) and jobs whose run stopped (`processing` for more than 20 minutes).
   - Accounts with waiting jobs are found with a loose index scan, one probe per account, however long one account's queue is.
   - Accounts that are paused, cooling down or at their hourly limit are left out, so their jobs wait in place instead of being claimed and handed back on every run.
   - Each account's oldest due jobs are locked as they are read (`FOR UPDATE SKIP LOCKED`), so runs at the same moment take different jobs.
   - Accounts take turns: each account's oldest job first, then each one's second, until the batch is full. An account alone can fill the batch; a busy one cannot hold back another.
   - The same call turns any `sending` job older than 20 minutes into `needs_review`. It returns the rule's reply, its followers-only fields and the account's token with each job.
2. **Check** (`readinessPlan`): an expired comment becomes `expired`, a rule that was turned off or removed `skipped`, an account without a token `failed`. No limit is spent on these.
3. **Reserve** (`reserve_automation_send`): one transaction under an advisory lock, so every Worker sees the same counts and two jobs cannot both take the last free send. In order: a paused account holds the job; an account cooldown waits for it; the commenter already got the daily number of replies from this account (counting other comments, not retries of this one) skips it; then the rule's, account's, user's and instance's hourly limits, counting private replies only. When a scope is full, the job waits until the oldest send in that hour is an hour old; a full account is also marked (`automation_accounts.limited_until`) so later claims leave its jobs alone. On success the job becomes `sending`, its attempts count goes up, and an `automation_attempts` row records the request, with the sha-256 digest of the exact text, before it leaves.
4. **Send** (`sendPrivateReply`): `POST https://graph.instagram.com/v25.0/<ig-id>/messages` with `{ recipient: { comment_id }, message: { text } }` and the account's token as a Bearer header, 10 second timeout, never repeated inside the call. The text is the reply and link, or for a followers-only rule its request to follow and reply. Only the timeout can cut it off: a run starts a send only with the whole timeout and 2 seconds to spare, so the run's own deadline never turns a send into an unknown outcome.
5. **Finish** (`finish_automation_send`): records the outcome on the attempt and the comment in one transaction, keeps who Instagram says received an accepted reply (`recipient_id`, else the commenter's id), starts the followers-only wait (`gate_status = 'awaiting_reply'`), and sets a cooldown or a hold on the account when the answer calls for one.

A database error on one job is logged and the run moves on; that job's claim or reservation expires and the recovery above picks it up.

**Budgets.** Each run knows how many subrequests it may still make (the Workers Free plan allows 50 per invocation) and how long it may keep starting sends:

| Run | Subrequests | Time to start sends |
|---|---|---|
| Webhook, after the response | 50, less 10 for the request's own middleware, less the intake's queries | 20 seconds |
| Dispatch, every minute | 50 for replies; follow-ups get what replies did not use | 50 seconds |
| Retry from the activity list | 40 | 20 seconds |

The claim takes only as many jobs as the budget pays for (one for the claim, one spare, three per reply). When time runs short or the run is cancelled, it hands every job it has not started back in one update (`returnUnstarted`: `processing` to `queued`, due at once), so they go out on the next run instead of waiting for the 20 minute lease.

**Clocks.** New and retried jobs are due 30 seconds in the past, so a database clock slightly behind the Worker's still finds them due on the immediate run.

### What each answer does

| Instagram's answer | Comment | Attempt | Account |
|---|---|---|---|
| 200 with `message_id` | `accepted`, `message_id` and recipient kept | `accepted` | |
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

## Followers-Only Replies (`backend/services/automationFollowupProcessor.ts`)

**Status: in testing.** The flow is covered by tests with fakes and a local database, but it has not been tried with a real account. It depends on Meta sending the account's `messages` events, which may need Advanced Access for `instagram_business_manage_messages`; this instance runs on Standard Access. The app and the docs label it as testing, and it may or may not work.

Instagram does not let an app check whether a commenter follows the account until that person messages it, so the check cannot happen before the first private reply. A followers-only rule therefore works in two steps, and Twiligent never says a follow was checked when it was not.

1. **The private reply** sends the rule's first message (`follow_prompt_text`), with no link: for example "Follow this account, then reply to this message and the link is on its way." Once Instagram accepts it, the comment waits for the person's answer.
2. **Their answer** arrives as a `messages` webhook event and becomes a follow-up job (see Intake). Their message gives Instagram's consent for the profile read and opens Instagram's 24 hour window.
3. **The follow-up** is claimed like a reply (accounts take turns, paused and cooling accounts left out, `FOR UPDATE SKIP LOCKED`), then:
   - **Check** (`followupReadiness`): the 24 hours ran out: `expired`; the rule was turned off or is no longer followers-only: `skipped`; the comment no longer waits (link sent or reminders used): `skipped`; no token: `failed`.
   - **Follow check** (`readFollowStatus`): `GET /<igsid>?fields=is_user_follow_business` with the account's token as a Bearer header and a 5 second timeout. A read, so asking again is always safe.
   - **Decide** (`followupMessage`):

| Instagram says | Sent | Follow-up | Comment |
|---|---|---|---|
| Follows | The reply and link | `accepted`, kind `link` | `gate_status` `completed` |
| Does not follow | The reminder (`not_following_text`) | `accepted`, kind `reminder` | one reminder counted; the second closes the wait (`closed`) |
| Cannot say: consent error, no follow field, any other refusal | Nothing | `failed`, `follow_unverifiable`, with Instagram's reason | still waiting; a later message is checked again |
| Token or permission refused | Nothing | `failed`, `not_authorized` | still waiting |
| Rate limit, temporary error, no answer | Nothing | `retry_wait` 5 minutes, or `expired` past the window | still waiting |

   - **Reserve** (`reserve_automation_followup`): a paused account holds it and a cooldown waits for it. Follow-ups use the Send API, not the private reply allowance, so the hourly reply limits do not count them (`automation_attempts.kind = 'followup'`).
   - **Send** (`sendMessage`): `POST /<ig-id>/messages` with `{ recipient: { id: <igsid> }, message: { text } }`, 10 second timeout, never repeated. A slow follow check that leaves less than the send's whole timeout hands the job back unsent.
   - **Finish** (`finish_automation_followup`): the same answer table as private replies, plus the comment's wait. A lost answer is `needs_review` and is never sent again without a person.

Nothing about the follow is stored except the follow-up's outcome; the person's message text is never read or kept.

## Duplicates, Ambiguity and Reconciliation

- A notification Meta delivers twice is stored once: `unique (ig_user_id, comment_id)` for comments, `unique (ig_user_id, trigger_message_id)` for messages.
- A comment repeated inside one notification is stored once, and several messages from one person make one open follow-up.
- Two runs never send the same job: the claim locks rows, and the reservation only moves a job this run holds. The every-minute dispatch, the webhook's own runs and a retry can overlap safely.
- A job a run claimed but did not start is handed back at once; one whose run died before the request left is claimed again after its 20 minute lease.
- A send that may have reached Instagram (timeout, lost connection, a run that stopped while `sending`) is never retried on its own. It shows as Needs review.
- **Reconciliation.** The five minute runs that do not publish look for up to four Needs review replies in the conversation on Instagram (`automationReconciler`, Conversations API: the conversation with the commenter, then its latest messages). A message from the account with exactly the text that was sent (the same sha-256 digest), at or after the attempt (2 minutes of slack for the clocks), marks the reply `accepted` with reason `confirmed`, and a followers-only rule then starts waiting for the person. A reply not found stays Needs review with a note. Each is checked at most three times, 30 minutes apart, starting 5 minutes after the attempt. A conversation Instagram will not show counts as a check with its reason. Replies sent before digests were kept are not guessed at. The reconciler only reads from Instagram; it never sends.
- A person decides the rest after checking the conversation. If they retry and the first reply did arrive, Instagram refuses a second private reply to the same comment (10900), and the comment is marked skipped.
- Delivery is at least once into the queue and at most once to Instagram without a person's decision. Instagram reports acceptance, not delivery or reading, so the dashboard says "Accepted by Instagram" and never "Delivered".

## Comment Status Lifecycle

```
ignored                      (no rule matched; final)
queued -> processing -> sending -> accepted ----------------------------------------------.
   ^          |            |-> retry_wait -> processing ...                              |
   |          |            |-> failed | skipped | expired                                followers-only:
   |          |            '-> needs_review (no answer, or the run stopped)               awaiting_reply
   |          |                   '-> accepted (found in the conversation)                  |-> completed (link sent)
   |          |-> queued (held: account paused) | retry_wait (limit, cooldown)              '-> closed (reminders used)
   |          '-> skipped (rule off, recipient limit) | expired | failed (no token)
   '-- retry by the owner (failed, skipped, needs_review, within 7 days)
queued | retry_wait -> expired (the five minute expiry, without a claim)
```

| Status | Shown as | Meaning |
|---|---|---|
| `ignored` | No match | Received; no rule answers it |
| `queued` | Waiting, or Held | Waiting to send; Held when its account is paused |
| `processing`, `sending` | Sending | A run holds it |
| `retry_wait` | Trying again | Waiting for a retry, a cooldown or an hourly limit |
| `accepted` | Accepted by Instagram | Instagram took the reply |
| `accepted`, waiting for the person | Asked to follow | A followers-only reply; the link goes out when they reply and follow |
| `accepted`, follow-up failed or for review | Follow-up failed, Needs review | The message after their answer did not go out, or may have |
| `accepted`, `completed` | Link sent | Instagram confirmed the follow and accepted the link |
| `accepted`, `closed` | Not following | Every reminder was used; the link was not sent |
| `failed` | Failed | Instagram refused it, or it failed 5 times |
| `needs_review` | Needs review | It may have been sent; check before retrying |
| `skipped` | Skipped | Rule off, recipient limit, or already answered |
| `expired` | Expired | The 7 days ran out first |

Follow-ups use the same statuses, without `ignored`. Retry on an accepted followers-only reply requeues its latest failed, skipped or review follow-up inside its 24 hours.

## Limits and Controls

| Scope | Default | Set with |
|---|---|---|
| Instance, per hour | 1,000 private replies | `AUTOMATION_GLOBAL_HOURLY_LIMIT` |
| User, per hour | 500 private replies | `AUTOMATION_USER_HOURLY_LIMIT` |
| Instagram account, per hour | 200 private replies (Instagram allows 750) | `AUTOMATION_ACCOUNT_HOURLY_LIMIT`, at most 750 |
| Rule, per hour | none | the rule's hourly limit, 1 to 750 |
| Person, per day per account | 3 replies | `AUTOMATION_RECIPIENT_DAILY_LIMIT` |
| Replies per webhook request or dispatch | 10 | `AUTOMATION_BATCH_SIZE`, at most 15 |
| Reminders per followers-only reply | 2 | `MAX_FOLLOW_REMINDERS` in `lib/automationDelivery.ts` |

Follow-ups count toward none of the hourly reply limits; they respect account pauses and cooldowns.

| Control | Effect |
|---|---|
| `AUTOMATION_PAUSED=true` | Nothing is sent on the instance; comments and answers are still stored and matched |
| Pause an account (Replies switch) | Its replies and follow-ups wait in place and go out when resumed, within Instagram's windows |
| Turn a rule off | New comments stop matching it; its waiting replies and follow-ups are skipped |
| Retry an item | Puts a failed, skipped or review item, or its failed follow-up, back in the queue and starts it at once |

The batch cap of 15 comes from the Workers Free plan's 50 subrequests per invocation: each reply costs three (reserve, send, finish) and each follow-up four (the follow check too), plus the claim and the intake queries.

**Throughput.** One dispatch sends up to the batch size, so the queue drains at up to 600 replies an hour with the default batch and 900 at the cap, on top of the replies the webhooks send at once. Before the every-minute dispatch, leftovers drained at 120 an hour.

## Observability

| Signal | Where |
|---|---|
| Each reply and follow-up settled: ids, status, outcome, error codes | `automation reply settled`, `automation follow-up settled` log lines |
| A dispatch that claimed something: counts by outcome | `automation dispatch` |
| Each reconcile run: expired counts, review results, queue health (due, oldest due, waiting, stale, needs review, follow-ups due, paused and limited accounts) | `automation reconcile` |
| The queue falling behind: the oldest due reply waited over 10 minutes, or jobs are held by stopped runs | one `automation queue behind: ...` warning per run, so an incident does not flood the logs |
| Every non-dispatch cron run and its duration | `cron run finished` |
| Accounts at their limit, cooling down, held, or without message events | the Instagram accounts card on the Automations page |

Logs carry ids, statuses and error codes, never tokens, secrets, comment text or message text.

## Response Time

- Normally a few seconds: Meta delivers the webhook, the Worker stores it and sends the reply right after answering. A follow-up goes out the same way when the person replies.
- Up to a minute for a reply that waits for the dispatch: more than the batch in one notification, a webhook that stopped early, or a reply whose limit or cooldown just ended.
- Longer only while a limit, a cooldown, a pause or Meta's own delivery delay holds it.

## Data Kept and Removed

| Data | Kept | Removed |
|---|---|---|
| Matched comments: text, author, status, reply id, recipient id | 90 days | Daily retention, 1,000 a batch, up to 20,000 a day; also when the account or user is removed |
| Unmatched comments | 90 days, without text or author | Same |
| Reply attempts, with the digest of the text sent | With their comment | With their comment |
| Follow-ups: sender id, message id, outcome; never the message text | With their comment | With their comment |
| Rules, account controls | Until deleted | With the account |
| Audit events | 1 year | Daily retention; with the user |

## Costs

Everything runs on the existing Worker, Supabase project and Workers Free plan; nothing new is billed. Each comment costs one webhook request and, when matched, about four database calls and one Instagram request. Each follow-up costs one more Instagram call for the follow check. The Workers Free plan allows 100,000 requests a day, and cron runs count as requests: the every-minute dispatch is 1,440 a day, the five minute trigger 288 and the daily one 1, about 1.7% together. With the `messages` field selected, every direct message to a connected account is also a request. Past the daily allowance the free plan refuses requests rather than billing them, and Meta retries a refused webhook for 36 hours. Cloudflare Queues, KV and D1 are not used. Recheck Cloudflare's and Supabase's pricing pages before relying on these numbers.

## Files

| Layer | File |
|---|---|
| Routes | `routes/instagramWebhookRoutes.ts` (public), `routes/automationRoutes.ts` |
| Middleware | `middleware/metaWebhook.ts` |
| Controllers | `controllers/instagramWebhookController.ts`, `controllers/automationController.ts`, `inBackground()` in `controllers/http.ts` |
| Validators | `validators/instagramWebhookValidators.ts`, `validators/automationValidators.ts` |
| Services | `services/automationWebhookService.ts`, `services/automationProcessor.ts`, `services/automationFollowupProcessor.ts`, `services/automationReconciler.ts`, `services/automationService.ts`, `services/retentionService.ts` |
| Cron | `jobs/scheduled.ts` |
| Platform | `services/instagram/instagramMessaging.ts` |
| Rules | `lib/automationMatching.ts`, `lib/automationRules.ts`, `lib/automationDelivery.ts`, `lib/automationReview.ts`, `lib/automationHealth.ts`, `lib/metaWebhookSignature.ts` |
| Repositories | `repositories/automationRuleRepository.ts`, `automationCommentRepository.ts`, `automationFollowupRepository.ts`, `automationAccountRepository.ts`, `auditRepository.ts` |
| Database | `supabase/migrations/20261016100000` to `20261016103500` and `20261016120000` to `20261016122500`, one entity per file |
| App | `frontend/src/features/automations/` |
