# Platform v2 research

Research for issue #143, done on 2026-11-05 before any code changed. It covers the four new areas of the platform v2 work (#142): the MCP server, YouTube publishing, Postiz as a reference, and the security skills. Each area has a full report in `research/`, with every claim marked as a fact (with its source), a third-party report or an inference. This page keeps the conclusions and the facts the design depends on.

| Report | Covers |
|---|---|
| [research/mcp.md](research/mcp.md) | The five MCP articles, the MCP specification (2026-07-28 and 2025-11-25), what Claude clients require, auth options, SDK or hand-written |
| [research/youtube.md](research/youtube.md) | Google OAuth, `videos.insert`, resumable uploads, quotas, Shorts, thumbnails, playlists, errors, Workers and Cloudinary limits, the recommended pipeline |
| [research/postiz.md](research/postiz.md) | Postiz's architecture from its source: providers, scheduling, Temporal workers, the YouTube provider, schema, what to adopt, adapt or avoid |
| [research/security-skills.md](research/security-skills.md) | The Cloudflare security-audit skill and the Trail of Bits skills: licences, structure, install method, which skills fit this stack |

---

## Facts the design depends on

Each was checked against the primary source on 2026-11-05. The three marked "re-checked" contradict older guides, so they were confirmed a second time.

| Fact | Source |
|---|---|
| The current MCP revision is 2026-07-28 and is stateless: no `initialize` handshake, no `Mcp-Session-Id`, and servers must implement `server/discover` (re-checked) | modelcontextprotocol.io/specification/2026-07-28/changelog |
| A server may serve legacy (2025-11-25, `initialize`) and modern clients on the same endpoint | modelcontextprotocol.io/specification/2026-07-28/basic/versioning |
| claude.ai, Desktop and mobile connectors sign in with OAuth; their callback is `https://claude.ai/api/mcp/auth_callback`; static bearer headers there are an organization-wide beta and cannot tell users apart | claude.com/docs/connectors/building/authentication |
| Claude Code accepts a remote server with `--header "Authorization: Bearer ..."` and caps tool output at 25k tokens | code.claude.com/docs/en/mcp |
| Supabase Auth has an OAuth 2.1 server (beta, every plan) with dynamic client registration; the app hosts the consent page; tokens carry `client_id` and `aud: authenticated` | supabase.com/docs/guides/auth/oauth-server |
| Videos uploaded by unverified Google Cloud projects are no longer locked to private; the 2020 rule was reversed on 2 November 2026 (re-checked) | developers.google.com/youtube/data/revision_history |
| `videos.insert` has its own quota bucket: 100 calls a day at 1 unit each; every other method shares 10,000 units a day; quotas reset at midnight Pacific (re-checked) | developers.google.com/youtube/data/determine_quota_cost |
| There is no Shorts endpoint: a square or vertical video up to 3 minutes is a Short | support.google.com/youtube/answer/15424877 |
| `status.publishAt` works only with `privacyStatus: private`, so YouTube itself publishes a scheduled video | developers.google.com/youtube/v3/docs/videos |
| A resumable upload sends chunks in multiples of 256 KiB; an empty PUT with `Content-Range: bytes */TOTAL` returns the real offset, or the finished video if the last response was lost | developers.google.com/youtube/v3/guides/using_resumable_upload_protocol |
| OAuth clients in Testing status get refresh tokens that expire after 7 days | developers.google.com/identity/protocols/oauth2 |
| Workers Free: 10 ms CPU and 50 subrequests per invocation; cron runs get 15 minutes of wall time; `FixedLengthStream` streams a body of known length without buffering | developers.cloudflare.com/workers/platform/limits |
| Cloudinary delivery URLs answer `Range` requests with 206; the free plan accepts videos up to 100 MB | Measured with a test request; cloudinary.com/pricing |
| Postiz is AGPL-3.0: it can be studied, not copied | github.com/gitroomhq/postiz-app LICENSE |
| The Cloudflare skill is MIT, the Trail of Bits skills are CC-BY-SA-4.0; installing them as plugins puts no obligation on this repository, copying them in would | Both repositories' LICENSE files |

---

## Conclusions

### MCP server

- **Transport:** one Streamable HTTP endpoint, `POST /mcp`, on the existing Worker. JSON responses only, no sessions, `GET` and `DELETE` answer 405. It answers both the legacy `initialize` handshake (what claude.ai speaks today) and modern stateless requests.
- **Protocol code:** written by hand in Hono. A tools-only, sessionless server needs about six methods; the official SDK would add `zod` and several megabytes to a Worker whose rule is no extra runtime dependencies.
- **Sign-in:** Supabase Auth's OAuth 2.1 server for claude.ai, Desktop and mobile (the owner chose this on 2026-11-05), and personal access tokens made in Settings for Claude Code and scripts. The Worker stays a resource server: it never issues OAuth tokens itself.
- **Tool design:** narrow tools named for the task, reads separate from writes, annotations on every tool, results under about 10k tokens with pagination, idempotency keys on create tools, and a two-step confirmation for anything irreversible or public, because clients cannot be relied on to ask the person.
- **Untrusted content:** comment text, captions and video titles come from other people. Tools return them as data fields, never as instructions, and mark themselves `openWorldHint`.

### YouTube publishing

- **Connection:** Google OAuth with `youtube.upload` and `youtube.readonly` (plus `youtube.force-ssl` only for playlists), `access_type=offline` and `prompt=consent`. Refresh tokens are encrypted at rest and never leave the Worker.
- **Upload early, let YouTube publish:** a scheduled video uploads soon after it is saved, as private with `publishAt`, so processing errors show hours before the publish time and the time-critical step is YouTube's.
- **Bytes:** the browser uploads to Cloudinary as Instagram publishing already does; a background job streams 8 MiB byte ranges from Cloudinary into the resumable session, a few chunks per run, with the session URI and offset saved in Postgres.
- **Exactly one video:** at most one upload session per job, saved before any bytes are sent; Google's status query is the source of truth for the offset; an outcome that cannot be known goes to review, never a blind retry.
- **Quota:** a ledger per Pacific day and bucket, reserved before each call.
- **Risk to measure:** whether 10 ms of CPU per run is enough to pipe a chunk on the Workers Free plan. The GitHub Actions scheduler, which has no such limit, runs the same claim and loop as the fallback.

### Postiz

- Adopt: the resumable upload state machine with a status query before every resume; separate "rejected", "never started" and "outcome unknown" results; save the video id when a later step such as the thumbnail fails; a provider interface with a static registry; never overwrite a stored refresh token with an empty one.
- Adapt: Temporal's durable workflows become a Postgres job row with a lease, moved forward by cron runs.
- Avoid: Temporal, BullMQ, Elasticsearch, plain-text tokens, fixed-IV encryption, soft-deleted media that is never removed, and heavy SDKs such as `googleapis`.

### Security skills

- Reference both repositories as Claude Code plugins in `.claude/settings.json`; do not copy their files (the owner chose this on 2026-11-05).
- Full audit: the Cloudflare `security-audit` skill in full mode, plus Semgrep through `static-analysis`, `supply-chain-risk-auditor`, `insecure-defaults` and `sharp-edges`.
- Small change: the Cloudflare skill in guidance mode on the changed paths, Semgrep on the changed files, `insecure-defaults` on the touched area.
- Pull request: `differential-review` in a worktree (it runs `git checkout`), Semgrep, and the built-in `/security-review`.
- Vulnerability details for this public repository go into private security advisories, not public issues.

---

## Open questions

These were not settled by the sources and are tracked in the implementation plan:

- How long a YouTube resumable session stays valid (Drive and Cloud Storage document one week).
- Whether an unfinished upload session counts against the 100 uploads a day.
- The Worker CPU time for one 8 MiB chunk on the Free plan; measured after the first deploy.
- Whether claude.ai sends an `Origin` header to remote servers, and whether it supports elicitation.
- Supabase's OAuth server ignores the `resource` parameter and fixes loopback ports exactly (issues #2610, #2703 in `supabase/auth`); personal access tokens cover Claude Code until that is fixed.
