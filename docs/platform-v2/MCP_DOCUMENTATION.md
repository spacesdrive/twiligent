# MCP server

Twiligent's Model Context Protocol server lets a person connect Claude (Claude Code, Claude Desktop, claude.ai) to their own Twiligent account and work with their dashboard by asking: read analytics, see and schedule posts, change settings. It is part of the Worker, not a separate service, and every tool calls the same services the app uses, under the same per-user rules. Issue #146; design in `ARCHITECTURE.md` section 2; research in `research/mcp.md`.

---

## Architecture

```
Claude client
   | POST /mcp  (JSON-RPC 2.0, one message per request)
   v
Worker pipeline: CORS -> request id and deadline -> security headers -> clients -> IP rate limit
   -> requireMcpAuth (access token, or OAuth token of an approved client) -> MCP rate limit (per user)
   -> handleMcpMessage (controllers/mcpController.ts)
   -> McpService (services/mcpService.ts): envelope checks, method dispatch, permission, confirmation, timeout
   -> tool (backend/mcp/tools/*.ts): validates input with backend/validators/, calls one service method
   -> services -> repositories -> Postgres, Redis, platforms
```

| Part | File | Job |
|---|---|---|
| Envelope | `backend/lib/mcp/protocol.ts` | Parse one JSON-RPC message, tell a legacy (handshake) client from a 2026-07-28 client, check headers against the body, build initialize, discover and error replies |
| Tokens | `backend/lib/mcp/accessToken.ts` | Generate `twl_` tokens and hash them (SHA-256) |
| Confirmations | `backend/lib/mcp/confirmation.ts` | Sign and verify the token that approves an irreversible action |
| Sign-in | `backend/middleware/mcpAuth.ts` | Origin check, credential check, sets `userId` and `mcpPrincipal` |
| Access | `backend/services/mcpAccessService.ts` | Create, list and revoke tokens; approve, list and revoke OAuth clients; sign a caller in |
| Dispatch | `backend/services/mcpService.ts` | initialize, ping, server/discover, tools/list, tools/call |
| Tools | `backend/mcp/registry.ts`, `backend/mcp/tools/` | The tool list and each tool's schema, permission and handler |
| Storage | `mcp_access_tokens`, `mcp_client_grants`, `audit_events` | Token hashes, approved clients, the record of every write |

### Protocol

- **Transport:** Streamable HTTP on one endpoint. `POST /mcp` takes one JSON-RPC request or notification and answers with JSON; a notification gets `202` with no body. `GET` and `DELETE /mcp` answer `405`: there is no server stream and no session.
- **Versions:** `2026-07-28` (stateless, version in `_meta` and the `MCP-Protocol-Version` header) and the handshake-based `2025-11-25`, `2025-06-18` and `2025-03-26`, which Claude's hosted apps speak today. `initialize` is answered with the client's version when supported, otherwise `2025-11-25`, and never creates a session id.
- **Modern requests** must send `MCP-Protocol-Version`, `Mcp-Method` and, for `tools/call`, `Mcp-Name` matching the body (base64 `=?base64?...?=` values are decoded first); a mismatch is `400` with code `-32020`, an unknown version `400` with `-32022` and the supported list, an unknown method `404` with `-32601`.
- **Methods:** `initialize`, `notifications/initialized`, `ping`, `server/discover`, `tools/list`, `tools/call`. Resources, prompts, sampling and elicitation are not offered.

---

## Signing in

Two kinds of credential reach `/mcp`. Both end in the same thing: the verified user id the rest of the Worker trusts, plus a permission, `read` or `write`.

### Personal access tokens (available now)

For Claude Code, Claude Desktop config files and scripts.

1. In Twiligent, Settings, Claude, create a token: a name, what it may do (read only, or read and make changes) and when it expires (or never).
2. Copy it. It is shown once; only its SHA-256 hash and last four characters are stored.
3. Send it as `Authorization: Bearer twl_...` on every request.

A token stops working when it is revoked or expires; the answer is the same `401` for an unknown, revoked or expired token. A person can hold 20 active tokens. Last used is recorded at most once an hour.

### OAuth through Supabase Auth (claude.ai, Desktop and mobile connectors)

Claude's apps only accept OAuth for remote servers. Twiligent stays a resource server: Supabase Auth's OAuth 2.1 server issues the tokens.

1. Claude calls `/mcp` without a token and gets `401` with `WWW-Authenticate: Bearer realm="twiligent", resource_metadata=".../.well-known/oauth-protected-resource/mcp"`.
2. The metadata names `https://<project>.supabase.co/auth/v1` as the authorization server. Claude registers itself and sends the person to Supabase, which sends them to Twiligent's consent page.
3. The consent page shows the client's name and asks what it may do. The choice is saved in `mcp_client_grants`, then the page approves the request with Supabase.
4. Claude receives an access token and calls `/mcp` with it. The Worker checks it with Supabase Auth, requires a `client_id` claim (so an app session token copied from a browser is refused) and requires a grant for that client.

Removing a client in Settings deletes its grant, which stops it at the next call even while its token is still valid. Steps 2 and 3 need the owner to turn on the OAuth server (see Deployment); until then the challenge omits `resource_metadata` and the metadata endpoint answers `404`.

---

## Connecting Claude

The server URL is `https://<your Worker host>/mcp`; Settings, Claude shows it with a copy button.

### Claude Code

```bash
claude mcp add --transport http twiligent https://api.example.com/mcp --header "Authorization: Bearer twl_your_token"
```

Or in a project's `.mcp.json`, keeping the token out of the file:

```json
{
  "mcpServers": {
    "twiligent": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ${TWILIGENT_TOKEN}" }
    }
  }
}
```

### Claude Desktop with a token

Claude Desktop's own config takes local servers; reach a remote server with a token through `mcp-remote`:

```json
{
  "mcpServers": {
    "twiligent": {
      "command": "npx",
      "args": ["mcp-remote", "https://api.example.com/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer twl_your_token" }
    }
  }
}
```

### claude.ai, Desktop and mobile with OAuth

Settings, Connectors, Add custom connector, paste the server URL, then sign in and approve on Twiligent's consent page. Needs the OAuth server turned on.

---

## Tools

Every tool works only on the caller's own data. Read tools need no confirmation. Write tools need a `write` token or grant and are hidden from read-only callers (calling one anyway returns a tool error that explains how to allow changes). Tools marked "confirm" run only on a second call carrying a confirmation token.

| Tool | Kind | Input | Result |
|---|---|---|---|
| `list_accounts` | read | none | `accounts`: id, platform, name, handle, headline figures (never a token) |
| `get_youtube_channel_analytics` | read | `accountId` | `channel` figures and growth estimates, `uploads` averages and engagement, the best, worst and most recent `videos` |
| `list_youtube_videos` | read | `accountId`, `sort` (`recent` or `views`), `limit`, `cursor` | `videos`, `nextCursor`, `total`, `fetchedAt` |
| `compare_youtube_channels` | read | none | `channels`, combined `totals`, the `leaders` by subscribers, views and videos |
| `get_instagram_account_analytics` | read | `accountId` | `account` figures, `posts` averages and engagement rate, `byContentType`, `postFrequency`, the best and worst posts |
| `list_instagram_media` | read | `accountId`, `limit`, `cursor` | `posts` (captions cut at 300 characters, with a permalink), `nextCursor`, `total`, `fetchedAt` |
| `get_settings` | read | none | Which server keys are set (never their values); the GitHub repository setting |
| `get_instagram_publishing_limit` | read | `accountId` | Posts published in the last 24 hours and the limit |
| `update_github_settings` | write | `repoOwner`, `repoName`, `branch` | The saved setting |
| `list_media` | read | `limit`, `cursor` | `media` (id, type, public https `url`, size and dimensions, label), `nextCursor`, `total` |
| `import_media_from_url` | write | `url` (public https), `resourceType` (`image` or `video`), `label` | `media`. Cloudinary downloads the file, not the Worker; private and non-https addresses are refused |
| `update_media` | write | `mediaId`, `label` | `media` |
| `delete_media` | write, confirm | `mediaId` | `deleted`, `removedFromCloudinary`, and a `note` when the file stays on Cloudinary because the instance has no API secret |
| `list_youtube_channels` | read | none | `channels` (no tokens), `configured` |
| `list_youtube_uploads`, `get_youtube_upload` | read | `limit`, `cursor`; or `uploadId` | Upload jobs with state, progress, video id and error |
| `create_youtube_upload` | write, confirm when public, unlisted or scheduled | `connectionId`, `mediaId`, `title`, `privacy`, `madeForKids`, and optional `description`, `tags`, `categoryId`, `publishAt`, `syntheticMedia`, `notifySubscribers`, `thumbnailMediaId`, `clientRequestId` | `upload`, `alreadyQueued` |
| `update_youtube_upload` | write, confirm when it makes the video public, unlisted or scheduled | `uploadId` and the details to change | `upload` |
| `retry_youtube_upload` | write | `uploadId` | `upload` |
| `cancel_youtube_upload` | write, confirm | `uploadId` | `upload` |
| `list_scheduled_posts` | read | `status`, `limit` (1 to 50, default 20), `cursor` | `posts`, `nextCursor`, `total` |
| `get_scheduled_post` | read | `postId` | `post` |
| `schedule_instagram_post` | write, confirm | `accountId`, `mediaUrl` (public https), `scheduledAt` (future ISO 8601), `mediaType` (IMAGE, VIDEO, REELS, STORIES), `caption`, `shareToFeed`, `collaborators`, `altText`, `locationId` | `post`, `alreadyScheduled` (true when the same media was already scheduled for that account and time) |
| `update_scheduled_post` | write | `postId` and the fields to change | `post` |
| `cancel_scheduled_post` | write, confirm | `postId` | `cancelled` |

Each tool publishes its full JSON Schema in `tools/list`, with annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). The validators in `backend/validators/` enforce the same rules the REST API does. Analytics, accounts, tracked videos, media and YouTube tools follow in later phases (`IMPLEMENTATION_PLAN.md`).

### Confirmation

```json
// first call
{ "name": "cancel_scheduled_post", "arguments": { "postId": "p1" } }
// result
{ "status": "confirmation_required", "action": "Delete scheduled post p1 so it is never published.",
  "confirmationToken": "1762310000000.Xw3...", "expiresInSeconds": 300,
  "instructions": "Show the action to the person. Only if they agree, call this tool again with the same arguments plus confirmationToken." }
// second call, after the person agreed
{ "name": "cancel_scheduled_post", "arguments": { "postId": "p1", "confirmationToken": "1762310000000.Xw3..." } }
```

The token is an HMAC over the user id, the tool name, the arguments (in any key order) and an expiry five minutes ahead, with a key derived from `TOKEN_ENCRYPTION_KEY`. A token for other arguments, another tool or another person does not work. It does not rely on the client supporting elicitation, and text a model reads in a caption or comment cannot produce one.

---

## Errors

| Situation | Answer |
|---|---|
| No credential | HTTP `401`, `WWW-Authenticate` challenge, JSON-RPC error `-32001` |
| Unknown, revoked or expired token; expired OAuth sign-in; app session token | HTTP `401`, `-32001`, a message saying what to do |
| OAuth client not approved | HTTP `403` |
| `Origin` header from a site other than claude.ai, claude.com or the app | HTTP `403` |
| Too many requests | HTTP `429` with `Retry-After` (60 burst, then 1 a second per user, after the per-IP limit) |
| Body is not JSON | HTTP `400`, `-32700` |
| Not one JSON-RPC message (a batch, a response, no method) | HTTP `400`, `-32600` |
| Unknown tool or arguments that are not an object | `-32602` |
| Invalid tool input, not found, platform error | A tool result with `isError: true` and a message the model can act on |
| Tool took more than 25 seconds | Tool error that says to check whether the change happened before retrying |
| Result over about 10,000 tokens | Tool error asking for fewer items |
| Unexpected failure | Tool error with the request id; the details go only to the Worker log |

---

## Security

- **Identity comes only from the credential.** No tool takes a user id; every service call is scoped by the verified user id, so another person's ids answer "not found".
- **Least privilege.** `read` credentials never see write tools. Connecting or removing accounts, passwords and tokens are not available through MCP at all.
- **Irreversible and public actions need a confirmation** bound to the exact arguments.
- **No token passthrough.** The client's credential is never forwarded; platform calls use the stored per-user platform credentials, as the app does.
- **Untrusted content.** Captions, titles and comments are returned as data fields; the server instructions tell the model to treat them as data. Tools that return them set `openWorldHint`.
- **Secrets at rest.** Access tokens are stored as SHA-256 hashes; raw tokens are sent once with `Cache-Control: no-store`.
- **Abuse limits.** Per-IP and per-user rate limits, a 25 second tool timeout, a result size cap, 20 tokens a person.
- **Audit.** Token and client changes and every write tool call are recorded in `audit_events` (`mcp_access_token.called_tool` or `mcp_client.called_tool` with the tool and outcome, never the arguments).
- **Origin check.** A request with an `Origin` header from any site other than Claude's or the app's is refused, so a web page cannot use a person's browser to call the endpoint.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `BACKEND_URL` | yes (existing) | Builds the server URL (`<BACKEND_URL>/mcp`) and the metadata URL |
| `SUPABASE_URL` | yes (existing) | Names the authorization server (`<SUPABASE_URL>/auth/v1`) |
| `TOKEN_ENCRYPTION_KEY` | for write tools that confirm | At least 32 random characters; keys derived from it sign confirmations (and, with YouTube publishing, encrypt stored tokens). Generate with `openssl rand -base64 48` |
| `MCP_OAUTH_ENABLED` | for Claude's apps | `true` after the OAuth server is turned on in Supabase |

---

## Local development

1. `npm run dev` starts the Worker on `http://localhost:8787`; the endpoint is `http://localhost:8787/mcp`.
2. Sign in to the local app, create a token in Settings, Claude.
3. Try it with the MCP Inspector (`npx @modelcontextprotocol/inspector`, transport Streamable HTTP, header `Authorization: Bearer twl_...`) or with curl:

```bash
curl -s http://localhost:8787/mcp -H "Authorization: Bearer twl_your_token" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tests: `backend/tests/lib/mcp/`, `backend/tests/services/mcpService.test.ts`, `mcpAccessService.test.ts`, `backend/tests/mcp/`, `backend/tests/routes/mcpRoutes.test.ts`.

---

## Deployment

1. Apply the migrations (`npm run db:push`, then `npm run db:schema`): `mcp_access_tokens`, `mcp_client_grants` and the wider `audit_events` subject check.
2. Set `TOKEN_ENCRYPTION_KEY` with `wrangler secret put TOKEN_ENCRYPTION_KEY`, then deploy the Worker.
3. For Claude's apps: in the Supabase dashboard, Authentication, OAuth Server, turn the server on, allow dynamic client registration, set the authorization path to `/oauth/consent`; then `wrangler secret put MCP_OAUTH_ENABLED` with `true` and deploy.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `401` "This access token is not valid" | Revoked, expired or mistyped. Create a new token in Settings, Claude |
| `401` "App session tokens are not accepted" | A browser session token was used. Use an access token or connect with OAuth |
| `403` "not approved for your account" | The OAuth client's grant was removed. Connect again and approve it |
| `403` "Requests from this web page are not allowed" | The request came from a web page on another site. Connect from a Claude client |
| A write tool says the connection may only read | The token or grant is read only. Create a token that may make changes, or approve the client again with changes allowed |
| "cannot sign until its owner sets the TOKEN_ENCRYPTION_KEY" | Set the Worker secret (at least 32 characters) and deploy |
| claude.ai says it cannot find an authorization server | OAuth is not turned on: `MCP_OAUTH_ENABLED` is not `true`, or the Supabase OAuth server is off |
| `429` | The per-user limit; wait the `Retry-After` seconds |
