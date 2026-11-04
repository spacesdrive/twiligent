# MCP server for Twiligent: research findings

Research date: 2026-11-05. Scope: research only, no repository changes.

Labels used below:

- **[Fact]** verified in the source named next to it.
- **[Report]** a third-party report (GitHub issue, blog) that I could confirm exists but not reproduce.
- **[Inference]** my own reasoning; treat as a proposal, not a fact.

---

## 0. The short version

1. **The MCP spec changed shape in 2026.** The current revision is **2026-07-28** and it is stateless: no `initialize` handshake, no `Mcp-Session-Id`, no `ping`, no GET stream. Every request carries its version and capabilities in `_meta`, and servers MUST implement `server/discover`. [Fact, https://modelcontextprotocol.io/specification/versioning and https://modelcontextprotocol.io/specification/2026-07-28/changelog]
2. **Claude clients still speak the older, handshake-based revisions.** Anthropic's connector docs say Claude follows the 2025-03-26, 2025-06-18 and 2025-11-25 authorization specs. Claude Code has a "v2 runtime" that adds 2026-07-28, and a switch to force legacy. So a Twiligent server must be **dual-era**: answer `initialize` (legacy) and per-request `_meta` (modern) on the same endpoint. [Fact, https://claude.com/docs/connectors/building and https://code.claude.com/docs/en/mcp]
3. **Transport:** one Streamable HTTP endpoint (`POST /mcp`), JSON responses only (no SSE needed for a tools-only server), no sessions, GET and DELETE answer 405. This is legal in both eras and fits a stateless Worker. [Fact for legality; Inference for the choice]
4. **Auth for claude.ai needs OAuth.** Static bearer headers exist on claude.ai but are a beta for "a limited set of organizations" and the value is one credential shared by the whole organization, not per user. Authless is supported but useless for per-user data. [Fact, https://claude.com/docs/connectors/building/authentication]
5. **Recommended auth:** Supabase Auth's OAuth 2.1 server (beta, all plans) as the authorization server, the Worker as a pure resource server that verifies Supabase JWTs locally against JWKS, plus a Custom Access Token Hook that stamps the MCP URL as `aud` on OAuth tokens. Add hashed personal access tokens (PATs) as a second path for Claude Code and scripts. Keep Cloudflare's `workers-oauth-provider` as the fallback if Supabase's gaps block you (it is a dependency and needs KV). Do not hand-write an authorization server. Details and caveats in section 4.
6. **Protocol code:** hand-write the JSON-RPC layer in Hono (about 6 methods, small) instead of adding `@modelcontextprotocol/server` (pulls `zod` 4 and `@modelcontextprotocol/core`) to the Worker. Use the official SDK client only as a dev dependency in tests to prove conformance, if the owner approves that. Details in section 5.

---

## 1. The five articles

### 1.1 Alloy Automation, "Building Production-Ready MCP Servers: What our engineering team learned" (2025-11-17)

URL: https://runalloy.com/blog/building-production-ready-mcp-servers/

Read status: the URL with a trailing slash returned only site navigation through two fetchers. The same article without the trailing slash (https://runalloy.com/blog/building-production-ready-mcp-servers) returned the full text, which I read in full.

Concrete recommendations:

- Layered architecture: gateway/router authenticates and applies restrictions, a service layer holds business logic, an infrastructure layer holds the protocol and external APIs ("domain / application / infrastructure").
- Per-tenant isolation: each tenant (their "server ID") gets its own auth tokens, restriction rules, custom instructions, rate limits and audit trail.
- Stateless scaling: each request carries the tenant id, "no session state needed".
- Token security: store tokens hashed, give them an expiry, generate them securely (`accessTokenHash`, `tokenExpiresAt`).
- Security model "Default Deny": nothing is allowed without an explicit permission; validate at several layers (tool, connector, action, user).
- Permissions evaluated in three stages: filter what the model can discover, filter actions within allowed connectors, then enforce again at execution time and throw a typed error if blocked.
- Separate read from delete: enterprises refused to give AI access to delete functions; "think about permissions, not restrictions", start from nothing and grant.
- Write tool parameter descriptions as instructions the model follows ("ALWAYS use get_connector_resources first", "NEVER guess"). Note: Anthropic's directory review rejects descriptions that "tell Claude how to behave" beyond the tool's function (section 3.4), so keep such guidance factual.
- "Smart hints": return contextual guidance in results and errors (suggest lookup or search actions instead of listing 50,000 records; error analysis that names the correct id or next tool).
- Large responses: above 50 items, return a sample plus options (search, filter, paginate, summary). Below that, hard caps: max 200 array items, max 10 KB strings, max 2 MB total, and truncate "with clear messages about what was cut".
- "Measure context usage, it's your most precious resource."
- Start simple and add complexity only when proven necessary; explicit configuration over inference.
- Rate limiting per tenant and audit trails for compliance are stated requirements.

### 1.2 Arif Dewi, "Building Your First Production-Ready MCP Server: A Weekend Project That Actually Shipped" (Medium, 2025-10-02)

URL: https://medium.com/@arifdewi/building-your-first-production-ready-mcp-server-a-weekend-project-that-actually-shipped-131305c69d54

Read status: WebFetch got HTTP 403. The Parallel fetcher returned the full article text, which I read in full.

Concrete recommendations (note: the article is about a local stdio server in Docker, so most points do not transfer to a remote Worker):

- Start with the simplest transport that works; the author chose stdio for a Docker-packaged server. [Not applicable to a remote server for claude.ai, which needs Streamable HTTP.]
- Security even for internal tools: non-root container user, minimal base image (Alpine), SBOMs and provenance, multi-arch images, automated security patches.
- CI that builds images, publishes, signs SBOMs and runs tests.
- One-command install and drop-in config; "clear error messages"; developer experience drives adoption.
- Use the official SDK so you do not hand-write protocol negotiation, registration, error handling and transports.
- Document relentlessly: README with examples, troubleshooting and use cases.
- Keep tools few and clear (the example has two tools: resolve an id, then fetch by id).

### 1.3 dev.to (guang_diyuzhi), "MCP in Production: Is the Model Context Protocol Ready in 2026?"

URL: https://dev.to/guang_diyuzhi_74b0fec2c09/mcp-in-production-is-the-model-context-protocol-ready-in-2026-5205

Read status: fetched with WebFetch, which returns a model-extracted digest, not verbatim text. The digest covered the whole article.

Concrete recommendations and claims:

- Verdict: ready for single-user and small-team agent workflows, "not yet ready" for large multi-tenant systems with strict security and observability needs.
- Maturity table: tool calling solid, resources solid, prompts early, Streamable HTTP maturing, structured logging inconsistent, OAuth for remote servers "still rough".
- Return clean structured errors; silent failures cascade because the agent assumes a tool ran and produces confident wrong output.
- Budget debugging time; distributed agent stacks are harder to debug than monoliths.
- Check the ecosystem for a maintained server before building; vet the servers you depend on.
- Build a server once and reuse it across clients.

### 1.4 The New Stack (Janakiram MSV), "15 Best Practices for Building MCP Servers in Production" (2025-09-15)

URL: https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/

Read status: WebFetch returned only page chrome. The Parallel fetcher returned the full page (83 KB); I extracted and read the article body in full.

The 15 practices:

1. Treat each server as a bounded context: one domain, cohesive uniquely named tools, JSON-Schema inputs and outputs, enums where possible, documented failure modes.
2. Prefer stateless, idempotent tools: agents retry and parallelize; accept client-generated request ids; deterministic results; pagination tokens and cursors for lists.
3. Choose the transport and implement cancellation and timeouts. (It says SSE was replaced by Streamable HTTP in 2025-06-18; in fact Streamable HTTP arrived in 2025-03-26 per the spec's own note.)
4. Use elicitation to fill missing parameters or confirm risky actions, never to harvest sensitive data; validate responses; gate with capability checks and fall back when unsupported.
5. Security first: follow the spec's security best practices; "don't use session IDs for auth"; non-predictable session ids; verify all requests; minimize data exposure; implement authorization server metadata discovery and dynamic client registration; never echo secrets in results or elicitation. (Its claim that OAuth 2.1 is "mandatory" for HTTP transports is wrong: the spec says authorization is OPTIONAL.)
6. Structured content for the model plus content blocks for people (`outputSchema`, `structuredContent`); actionable errors with machine-readable codes.
7. Instrument like a microservice: structured logs with correlation ids, tool name, invocation id, latency, success or failure; surface rate limits so agents can budget calls.
8. Semantic versioning for the server and for tools on breaking changes; advertise capabilities.
9. Keep prompts, tools and resources decoupled; resources are read-only with URIs and pagination.
10. Stream incremental results for long operations; return handles or URIs instead of megabytes inline.
11. Test against real hosts with fault injection (slow downstreams, partial failures, malformed input); use the Inspector.
12. Package like a microservice; README with tool catalog, schemas, examples, security notes.
13. Capabilities differ by host; feature-flag and degrade gracefully.
14. Behind the MCP layer keep a clean API: least privilege, clear lifecycles, idempotent mutations. "MCP is just the adapter."
15. For anything that changes state or spends money, require confirmation (elicitation or a dry-run mode) and return a diff of intended changes before execution; machine-readable change summaries.

### 1.5 dev.to (Mads Hansen), "MCP in production: what nobody tells you before you start"

URL: https://dev.to/mads_hansen_27b33ebfee4c9/mcp-in-production-what-nobody-tells-you-before-you-start-21m

Read status: fetched with WebFetch (digest, not verbatim). The article is short and database-focused.

Concrete recommendations:

- Schema quality matters more with AI in the loop: vague names and undocumented relationships make the model assume wrong things.
- Plan capacity for about 10x the expected query volume; plan connection pooling and rate limits accordingly.
- "Your MCP server should enforce read-only access by default"; least privilege; tighten over-provisioned permissions.
- Use MCP for exploratory, ad-hoc questions; answer recurring questions with precomputed metrics or dashboards.
- (A reader comment promoting a commercial gateway is not part of the article.)

### 1.6 What the five agree on (Inference)

Read-only by default and explicit grants for writes; per-user isolation and rate limits; idempotent writes; small, paginated, truncated-with-notice responses; actionable structured errors; correlation-id logging and audit trails; confirmation before state changes; test with real clients. Two of the five (Alloy, The New Stack) are substantive; the other three are light.

---

## 2. The MCP specification, verified

**Latest revision: 2026-07-28** ("The **current** protocol version is 2026-07-28"). Revisions 2025-11-25 and earlier are called "legacy" (handshake-based). [Fact, https://modelcontextprotocol.io/specification/versioning]

### 2.1 Streamable HTTP in 2026-07-28 (modern)

Source: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http

- Single endpoint: "The server **MUST** provide a single HTTP endpoint path ... that supports POST." [Fact]
- Every client message is its own POST; client MUST send `Accept` listing both `application/json` and `text/event-stream`. [Fact]
- A notification gets `202 Accepted` with no body (or an HTTP error if refused). [Fact]
- A request gets either `Content-Type: application/json` (one JSON object) or `text/event-stream` (an SSE stream scoped to that request); "The client **MUST** support both." So a server may always answer with JSON. [Fact]
- No GET stream, no sessions, no resumability: a server that supports only this revision SHOULD answer GET or DELETE with `405`, ignore any `Mcp-Session-Id` ("do not mint or echo session IDs"), and ignore `Last-Event-ID`. [Fact]
- Long-lived change notifications now use a `subscriptions/listen` POST whose response is a long-lived SSE stream. A tools-only server with a fixed tool list does not need it. [Fact for the mechanism; Inference that Twiligent can skip it]
- Cancellation on HTTP: closing the response stream is the cancel signal. [Fact]
- Request metadata headers: every POST MUST carry `MCP-Protocol-Version`, and it MUST match `_meta["io.modelcontextprotocol/protocolVersion"]`, else `400` with JSON-RPC error `-32020` (HeaderMismatch). `Mcp-Method` is required on all requests and `Mcp-Name` on `tools/call` (Base64 sentinel `=?base64?...?=` for unsafe values); servers MUST validate they match the body. Unsupported version: `400` with `UnsupportedProtocolVersionError` (`-32022`) listing `supported`. Unknown method: `404` with `-32601`. [Fact]
- A request with no `MCP-Protocol-Version` header MAY be treated as `2025-03-26` by a server that supports old clients. [Fact]
- Origin: servers MUST validate `Origin` on all incoming connections; if present and invalid, respond `403`. Servers SHOULD implement authentication for all connections. [Fact]
- SSE responses SHOULD include `X-Accel-Buffering: no`. [Fact]

### 2.2 Streamable HTTP in 2025-11-25 (legacy, what Claude clients use today)

Source: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports and .../basic/lifecycle

- Single endpoint supporting POST and GET. GET: server MUST return `text/event-stream` "or else return HTTP 405 Method Not Allowed". So a server without a GET stream is compliant. [Fact]
- POST body is one request, notification or response; notifications and responses get `202`; requests get JSON or SSE. [Fact]
- **Sessions are optional:** "A server ... **MAY** assign a session ID at initialization time" via the `MCP-Session-Id` header. If assigned, clients MUST echo it; a terminated session gets `404`; clients SHOULD DELETE to end it; servers MAY answer DELETE with `405`. A server that never assigns one runs stateless. [Fact]
- `MCP-Protocol-Version` header on all requests after initialize; missing header SHOULD be assumed `2025-03-26`; invalid or unsupported MUST get `400`. [Fact]
- Origin validation: same MUST and 403 as above. [Fact]
- Lifecycle: client sends `initialize` (protocolVersion, capabilities, clientInfo); server MUST reply with its capabilities and serverInfo (optional `instructions`); if it supports the requested version it MUST echo it, otherwise reply with another version it supports. Client then sends `notifications/initialized`. [Fact]
- Ping (legacy): either side may send `ping`; the receiver must answer promptly with an empty result. (Removed in 2026-07-28.) [Fact for removal, changelog item 5; the ping rule is in the 2025-11-25 utilities page linked from lifecycle]

### 2.3 Minimal method set for a dual-era tools-only server

| Method | Era | What to do |
|---|---|---|
| `initialize` | legacy | Reply with `protocolVersion` (echo if supported, else latest legacy you support), `capabilities: { tools: { listChanged: false } }`, `serverInfo`, optional `instructions`. No session id. |
| `notifications/initialized` | legacy | `202`, no body. |
| `ping` | legacy | `{}` result. |
| `server/discover` | modern (MUST) | `supportedVersions`, `capabilities`, `_meta.serverInfo`, `instructions`, `ttlMs`, `cacheScope`, `resultType: "complete"`. |
| `tools/list` | both | Tools in deterministic order; modern results add `resultType`, `ttlMs`, `cacheScope`. Use `cacheScope: "private"` if the list depends on the user's scopes. |
| `tools/call` | both | Run the tool; return `content` (+ `structuredContent`), `isError`. Modern adds `resultType`. |
| any other request | both | JSON-RPC `-32601` (modern: HTTP 404). |
| GET / DELETE on `/mcp` | both | `405`. |

[Fact for each requirement, from the pages above; Inference for the exact dual-era table.]

The spec explicitly allows a dual-era server: "A server that wishes to support both legacy clients ... and modern clients ... **MAY** implement both behaviors." It picks the era per request: a request with modern `_meta` is served statelessly; an `initialize` request selects legacy semantics. A modern-only server SHOULD name its supported versions in the error it returns to `initialize`. [Fact, https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning]

### 2.4 Tool definitions, annotations, structured output, errors

Source: https://modelcontextprotocol.io/specification/2026-07-28/server/tools ; annotation defaults from the schema as quoted in https://modelcontextprotocol.io/specification/2025-06-18/schema and the MCP blog post https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations

- Tool fields: `name`, `title`, `description`, `icons`, `inputSchema` (JSON Schema 2020-12 by default, MUST be an object schema; no-arg tools should use `{ "type": "object", "additionalProperties": false }`), optional `outputSchema`, optional `annotations`. [Fact]
- Names SHOULD be 1 to 128 chars, case-sensitive, only `A-Z a-z 0-9 _ - .`, unique per server. [Fact]
- `tools/list` MUST NOT vary per connection but MAY vary by the authorization on the request (for example by granted scopes). SHOULD be deterministic in order. [Fact]
- **Annotations (all hints, untrusted unless the server is trusted):**
  - `readOnlyHint` default false: tool does not modify its environment.
  - `destructiveHint` default true: may perform destructive updates (false means additive only); meaningful only when not read-only.
  - `idempotentHint` default false: repeated calls with the same args have no extra effect; meaningful only when not read-only.
  - `openWorldHint` default true: interacts with an open world of external entities.
  - `title`: display name. [Fact]
- **Structured output:** `structuredContent` is any JSON value; if `outputSchema` is given, servers MUST conform and clients SHOULD validate. "For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block." [Fact]
- **Errors, two kinds:** protocol errors (unknown tool, malformed request, server errors) are JSON-RPC errors such as `-32602`; tool execution errors (API failures, input validation, business logic) are results with `isError: true` and actionable text so the model can self-correct. [Fact]
- **Stateful tools:** with no sessions, use explicit server-minted handles passed as tool arguments; validate the caller against the handle on every call; opaque ids; state the lifetime in the description; return an `isError` result for expired handles. [Fact, same page, non-normative]
- **Server MUSTs:** "Validate all tool inputs; Implement proper access controls; Rate limit tool invocations; Sanitize tool outputs." [Fact]
- Elicitation in 2026-07-28 is done via **Multi Round-Trip Requests**: the server returns `resultType: "input_required"` with `inputRequests` and an opaque `requestState`; the client retries with `inputResponses`. `requestState` is attacker-controlled: if it affects authorization or business logic the server MUST integrity-protect it (HMAC or AEAD), SHOULD bind it to the principal, a short TTL and the original request, and MUST enforce single use server-side when needed. Servers MUST NOT send an elicitation the client did not declare. [Fact, https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr]

### 2.5 Authorization (2026-07-28)

Sources: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization , .../authorization/authorization-server-discovery , .../authorization/client-registration , .../authorization/security-considerations

- Authorization is OPTIONAL; HTTP implementations that do it SHOULD conform. Based on OAuth 2.1 (draft 13), RFC 6750, 8414, 7591, 8707, 9728, 9207, CIMD draft, OIDC Discovery. [Fact]
- **Roles:** the MCP server is an OAuth 2.1 resource server; the authorization server can be a separate entity. [Fact]
- **Protected Resource Metadata (RFC 9728):** MCP servers MUST implement it; the document MUST include `authorization_servers` with at least one entry. Servers MUST offer discovery either by a `WWW-Authenticate: Bearer resource_metadata="..."` header on 401, or at a well-known URI (`/.well-known/oauth-protected-resource/<mcp path>` or `/.well-known/oauth-protected-resource`). Clients MUST support both. [Fact]
- **Scopes:** servers SHOULD put `scope="..."` in the `WWW-Authenticate` challenge; `scopes_supported` should be the minimal set; insufficient scope at runtime is `403` with `error="insufficient_scope"`, `scope`, `resource_metadata`. Servers SHOULD NOT advertise `offline_access`. [Fact]
- **AS metadata discovery:** RFC 8414 or OIDC Discovery; for an issuer with a path (`https://x/tenant1`) clients try `/.well-known/oauth-authorization-server/tenant1`, then `/.well-known/openid-configuration/tenant1`, then `/tenant1/.well-known/openid-configuration`. Clients MUST reject metadata whose `issuer` differs. [Fact]
- **Client registration priority:** pre-registered, then Client ID Metadata Documents (CIMD, when the AS advertises `client_id_metadata_document_supported`), then Dynamic Client Registration (DCR). **DCR is deprecated in 2026-07-28** and kept for backward compatibility. Clients MUST send an `application_type` in DCR. [Fact]
- **PKCE:** clients MUST use PKCE with S256 and MUST refuse to proceed if `code_challenge_methods_supported` is absent from AS metadata. [Fact]
- **Resource indicators (RFC 8707):** clients MUST send `resource` (the canonical MCP server URI, no fragment, preferably no trailing slash) in both authorization and token requests. [Fact]
- **Tokens:** sent only in the `Authorization: Bearer` header, on every request, never in the query string. Servers MUST validate tokens per OAuth 2.1 section 5.2, MUST validate that the token was issued for them as audience, MUST answer invalid or expired tokens with 401, and "MUST NOT accept or transit any other tokens". [Fact]
- **No token passthrough:** if the MCP server calls upstream APIs it uses a separate upstream token; it MUST NOT pass through the client's token. [Fact]
- **Issuer check (RFC 9207):** ASs SHOULD return `iss` in authorization responses; clients MUST validate it. [Fact]
- **Token theft:** ASs SHOULD issue short-lived access tokens; for public clients they MUST rotate refresh tokens. All AS endpoints MUST be HTTPS; redirect URIs MUST be localhost or HTTPS. [Fact]
- **Confused deputy:** applies to MCP *proxy* servers that use a static client id at a third-party AS while letting MCP clients register dynamically; they MUST obtain per-client consent before forwarding. [Fact] For Twiligent: the Worker does call Instagram, YouTube and Cloudinary with stored per-user platform tokens, but it does not run an OAuth proxy flow for MCP clients through Meta or Google, so the classic confused deputy does not arise as long as MCP sign-in only authenticates the Twiligent user and never triggers a platform OAuth flow. [Inference]

### 2.6 Security best practices page

Source: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices

- Confused deputy (proxy servers): per-client consent registry checked before third-party authorization; consent page MUST name the client, show the scopes and the redirect URI, have CSRF protection, and block framing (`frame-ancestors` or `X-Frame-Options: DENY`); consent cookies use `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, signed, bound to `client_id`; exact `redirect_uri` match; `state` generated securely, stored only after consent, single use, short expiry (for example 10 minutes). [Fact]
- Token passthrough: "MCP servers **MUST NOT** accept any tokens that were not explicitly issued for the MCP server." [Fact]
- SSRF (mainly clients, and authorization servers that fetch CIMD documents): HTTPS only, block private ranges, validate redirects, egress proxies. [Fact]
- State handle hijacking (replaces "session hijacking" in 2026-07-28): MUST verify every request; MUST NOT treat a handle as authentication; SHOULD use random handles bound server-side to the authenticated user (`<user_id>:<handle>`). [Fact]
- Local server compromise, OAuth URL validation, stdio proxy issues: client-side and local concerns, not relevant to a remote Worker. [Fact for content; Inference for relevance]
- Scope minimization: minimal initial scopes, step-up via `WWW-Authenticate` challenges, no wildcard scopes, log elevation events. [Fact]

---

## 3. What Claude clients require today

### 3.1 claude.ai, Claude Desktop, mobile, Cowork (remote custom connectors)

Sources: https://claude.com/docs/connectors/building , https://claude.com/docs/connectors/building/authentication , https://claude.com/docs/connectors/custom/add-unlisted , https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

- Available on Free (one custom connector), Pro, Max, Ultra, Team, Enterprise. [Fact]
- Connections come from Anthropic's cloud even in Desktop and Cowork, so the server must be reachable from the public internet; egress range `160.79.104.0/21`. [Fact]
- Transport: Streamable HTTP (legacy HTTP+SSE still supported, being deprecated). [Fact]
- Supported OAuth authorization spec versions: 2025-03-26, 2025-06-18, 2025-11-25. 2026-07-28 is not listed for the hosted apps. [Fact] (Whether claude.ai's MCP client speaks the 2026-07-28 wire protocol is not stated; I could not verify it.)
- Not supported: resource subscriptions, sampling, "advanced or draft capabilities". Elicitation support on claude.ai is **not documented** on these pages. [Fact for the list; unverified for elicitation]
- Limits: max tool result about 150,000 characters; tool call timeout 240 seconds. [Fact]
- **Auth types:** `oauth_dcr` and `oauth_cimd` supported by default; `oauth_anthropic_creds` for directory listings; `custom_connection` by request; `static_headers` (API key or bearer in a request header) in **beta for a limited set of organizations**, entered once by an Owner and shared by everyone in that organization ("don't use it to identify which user is calling"); `none` (authless) supported. [Fact]
- In the add-connector dialog: Authentication "Sign in now", "Sign in when needed", or "No sign-in"; OAuth client "Use Claude's published identity (Recommended)" (CIMD), "Register automatically" (DCR), or "Use your own OAuth client" (client id, optional secret). Auth settings cannot be edited later; remove and re-add. [Fact]
- **Callback URL for hosted apps:** `https://claude.ai/api/mcp/auth_callback` (register exactly this). [Fact]
- Claude's OAuth client specifics: a `401` is required to start sign-in (a `WWW-Authenticate` on `200` is ignored); the PRM `resource` must equal the URL the user typed, including the path; only the first `authorization_servers` entry is used; CIMD is chosen only when AS metadata has both `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported`, otherwise Claude falls back to DCR; PKCE S256 on every request; requests `scope` from the 401 challenge, else `scopes_supported`, plus `offline_access` if the AS lists it; 10 second limit on discovery, registration and token endpoints, 30 seconds for refresh; refreshes on 401 and up to five minutes before expiry; expects `invalid_grant` for dead refresh tokens; token endpoint must accept `application/x-www-form-urlencoded`; no `client_credentials` grant. [Fact]
- If no `resource_metadata` pointer is sent, Claude probes `/.well-known/oauth-protected-resource/<mcp path>` then `/.well-known/oauth-protected-resource` on the MCP origin. [Fact]

### 3.2 Claude Code

Sources: https://code.claude.com/docs/en/mcp , https://claude.com/docs/connectors/building/authentication

- Add a remote server: `claude mcp add --transport http <name> <url>`; with a static token: `claude mcp add --transport http secure-api https://api.example.com/mcp --header "Authorization: Bearer your-token"`. Scopes: local (default, `~/.claude.json`), project (`.mcp.json`, shared via git), user. `.mcp.json` supports `"headers"` with `${VAR}` and `${VAR:-default}` expansion; `headersHelper` runs a command that prints a JSON object of headers (10 second timeout). [Fact]
- OAuth: `/mcp` in a session or `claude mcp login <name>`; `--callback-port` fixes the loopback port; `--client-id` and `--client-secret` for pre-registered clients; "Claude Code also supports servers that use a Client ID Metadata Document (CIMD)". [Fact]
- Claude Code uses a loopback redirect on an ephemeral port; its CIMD (`https://claude.ai/oauth/claude-code-client-metadata`) declares `http://localhost/callback` and `http://127.0.0.1/callback`, so the AS must match both **ignoring the port**. [Fact]
- Limits: warning above 10,000 tokens of tool output, cap 25,000 tokens by default (`MAX_MCP_OUTPUT_TOKENS`); per-server `timeout` or `MCP_TOOL_TIMEOUT`. Tool descriptions and server instructions loaded up front are capped at 4,096 characters; a tool loaded through tool search at 16,384. Tool full names (`mcp__<server>__<tool>`) over 128 characters are dropped. [Fact]
- Protocol: a v1 runtime (TypeScript SDK 1.x) and a v2 runtime (SDK 2.0, adds 2026-07-28); `MCP_SDK_GENERATION` and `MCP_PROTOCOL_NEGOTIATION=auto|legacy` choose. [Fact]
- Elicitation: Claude Code shows form and URL elicitation dialogs; it declares `elicitation: {form: {}, url: {}}` on 2026-07-28 connections and on legacy connections to servers in the user's own config (v2.1.287+). [Fact]
- Per-tool forced approval: setting `_meta["anthropic/requiresUserInteraction"]: true` on a tool in `tools/list` makes Claude Code prompt on every call, in every permission mode, with no "don't ask again". [Fact]
- Tool search defers tool definitions; good server `instructions` help Claude find the tools. [Fact]

### 3.3 Anthropic directory review rules worth adopting even for a private server

Source: https://claude.com/docs/connectors/building/review-criteria

- Separate read tools from write tools; ideally split writes into create, update, delete. No catch-all `api_request` tool. [Fact]
- Every tool has a `title` and the applicable hint: `readOnlyHint: true` for reads, `destructiveHint: true` for modifying or deleting tools; "Read-only tools can run without per-call confirmation, and destructive tools always prompt." [Fact]
- Tool names 64 characters or fewer. Narrow, accurate descriptions. [Fact]
- Descriptions must not instruct Claude to call other tools, pull instructions from external sources, contain hidden instructions, or override system behavior. [Fact]
- Actionable errors (no bare "Internal Server Error"); validate inputs; reasonably sized responses. [Fact]

---

## 4. Auth options for Twiligent compared

Facts about each option, then trade-offs. "Twiligent constraint" means the zero-new-runtime-dependency rule and the Cloudflare free plan.

### 4.1 (a) Supabase Auth OAuth 2.1 server

Facts:

- Status: "OAuth 2.1 server is in beta and available on all Supabase plans", no separate charge; OAuth users count toward MAU. [Fact, https://supabase.com/docs/guides/auth/oauth-server/getting-started]
- Supports authorization code with mandatory PKCE, OIDC (ID tokens, UserInfo, discovery), standard scopes only (`openid`, `email`, `profile`, `phone`; "Custom scopes are not currently supported"), DCR, JWKS. [Fact, https://supabase.com/docs/guides/auth/oauth-server and .../oauth-flows]
- Owner must: enable the OAuth 2.1 server (Authentication > OAuth Server, or `[auth.oauth_server] enabled = true`), set the Authorization Path (for example `/oauth/consent`, combined with the Site URL), turn on DCR (`allow_dynamic_registration = true`), and host a consent page in the frontend that calls `supabase.auth.oauth.getAuthorizationDetails`, then `approveAuthorization` or `denyAuthorization`. [Fact, getting-started and https://supabase.com/docs/guides/ai-tools/byo-mcp]
- Discovery at `https://<ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1` (RFC 8414 path insertion) and OIDC at `/auth/v1/.well-known/openid-configuration`; issuer `https://<ref>.supabase.co/auth/v1`. [Fact]
- Access tokens are normal Supabase JWTs with `user_id`, `role`, `client_id`; `aud` is `authenticated`; validate with the JWKS at `/auth/v1/.well-known/jwks.json`, checking signature, `iss`, `aud`, `exp`. Asymmetric signing keys (RS256 or ES256) are recommended and required for ID tokens; Supabase's own MCP middleware rejects legacy HS256. Custom Access Token Hooks run for OAuth tokens and can "Set the aud claim to the third-party API endpoint", keyed by `client_id`. [Fact, getting-started, oauth-flows, byo-mcp]
- Redirect URIs: exact match only, no wildcards. [Fact]
- Gaps reported in public GitHub issues, all **open** on 2026-11-05 (checked with `gh api`):
  - supabase/auth #2610 "support RFC 8707 Resource Indicators (resource parameter -> aud claim)": the `resource` parameter is accepted but ignored and tokens get `aud: "authenticated"`; PR #2894 open. [Report]
  - supabase/auth #2703 "authorize rejects RFC 8252 loopback ephemeral-port redirect_uri": exact match includes the port, so native clients like Claude Code that register `http://127.0.0.1/callback` and then use `:3118` get `400`; PR #2871 open. [Report]
  - supabase/auth #2850 "support Client ID Metadata Documents"; PR #2895 open. So CIMD is not supported today. [Report]

What it means for each client (Inference unless marked):

- claude.ai and Desktop: should work via DCR. Claude falls back to DCR when CIMD is not advertised [Fact, Claude docs], the callback `https://claude.ai/api/mcp/auth_callback` is a fixed HTTPS URL that exact matching accepts, and PKCE S256 is supported. The user picks "Register automatically" (or the default detection does). Not tested end to end.
- Claude Code: likely to fail with the default ephemeral port because of #2703. Workarounds: `claude mcp add ... --callback-port 8080` so the registered and used redirect URIs are identical, or use a PAT (option c). The `--callback-port` workaround is my inference from the docs, not tested.
- Audience: Supabase does not bind tokens to the MCP URL, which conflicts with the spec's MUST to validate audience. Mitigation: a Custom Access Token Hook (a Postgres function, added through a migration) that sets `aud` to the MCP server URL whenever `client_id` is present; the Worker then accepts on `/mcp` only tokens with that `aud` and a `client_id` claim, and keeps accepting `aud: "authenticated"` without `client_id` on the existing app routes. Needs a test that the existing web app and RLS keep working, because the hook runs on every token issuance. [Inference]

Pros: no new dependency; no new token store; users sign in with the account they already have; consent and grant revocation come from Supabase; works on the free plans. Cons: beta; three open gaps above; each self-hoster must enable it, switch to asymmetric keys and deploy the consent route; DCR is deprecated in the spec, and open DCR lets anyone register clients (consent page must clearly show the client name and redirect host).

### 4.2 (b) Cloudflare `workers-oauth-provider`

Facts (https://github.com/cloudflare/workers-oauth-provider ; npm):

- "adds OAuth 2.1 authorization to HTTP APIs and remote MCP servers running on Cloudflare Workers"; needs a KV namespace bound as `OAUTH_KV`, and the `global_fetch_strictly_public` compatibility flag if it accepts CIMD. [Fact]
- Supports pre-registered clients, CIMD (`clientIdMetadataDocumentEnabled: true`), DCR (RFC 7591), RFC 8707 resources and audiences, PKCE (RFC 7636). Tokens, codes and secrets stored only as hashes; `props` encrypted. Requests under `apiRoute` reach `apiHandler` with `ctx.props`; others go to `defaultHandler`, which renders `/authorize`. "The library advertises the required scopes but doesn't enforce them." [Fact]
- npm: version 1.2.4, no runtime dependencies listed, unpacked size about 486 KB. [Fact, `npm view` on 2026-11-05]

Inference: covers CIMD, DCR, audience binding and probably loopback matching, so it would satisfy claude.ai and Claude Code without workarounds. The Twiligent `/authorize` page would sign the user in with Supabase and call `completeAuthorization()` with `{ userId }`. Costs: it is a new runtime dependency (owner approval required), it wraps the Worker's top-level `fetch` (the Hono app becomes the `defaultHandler` or `apiHandler`), it adds KV (free plan KV write quotas are low; I did not verify the current numbers), and it creates a second token system next to Supabase sessions.

### 4.3 (c) Personal access tokens (PATs)

Facts: Claude Code sends any header you give it (`--header "Authorization: Bearer ..."`, `.mcp.json` `headers` with `${VAR}`, or `headersHelper`). claude.ai accepts a static `Authorization` header only in the `static_headers` beta, for a limited set of organizations, entered once by an Owner, shared organization-wide. [Fact, sections 3.1 and 3.2]

Inference: PATs are the simplest, dependency-free path and fully cover Claude Code, the API's MCP connector and scripts. They do not cover claude.ai for most users. Design: create in the dashboard, show once, store only a SHA-256 hash plus a short prefix for display, scopes (`read`, `publish`), expiry, last-used time, revoke button; table with RLS; a `...ForUser` repository. Prefix the token (for example `twl_pat_`) so the Worker can tell it from a JWT without trying to parse it, and so secret scanners can find leaks. Strictly speaking the MCP authorization spec covers OAuth tokens; a PAT is a separate, simpler credential the spec does not forbid, but a PAT-protected endpoint should still return a proper `401` (Claude docs require it to trigger sign-in) and never accept a token in the URL.

### 4.4 (d) Hand-written OAuth 2.1 authorization server in the Worker

Inference: technically possible with Web Crypto and Postgres tables (clients, codes, refresh tokens), and it could support CIMD, DCR, RFC 8707 and loopback any-port matching exactly as Claude needs. But it is the largest security surface of the four: PKCE, code single use, refresh rotation with reuse detection, `iss` responses, CIMD fetching with SSRF protection, consent CSRF and clickjacking protection, redirect validation, token revocation. The spec's own security pages list many MUSTs that are easy to get subtly wrong. Not recommended unless (a) proves unworkable and (b) is refused.

### 4.5 Comparison

| | (a) Supabase OAuth server | (b) workers-oauth-provider | (c) PATs | (d) Hand-written AS |
|---|---|---|---|---|
| claude.ai / Desktop | Yes via DCR (inference, untested) | Yes, CIMD or DCR | Only `static_headers` beta, org-shared | Yes if built right |
| Claude Code | Needs `--callback-port` workaround or a PAT (open issue #2703) | Yes | Yes | Yes |
| Spec audience MUST | Needs Custom Access Token Hook | Built in | Not OAuth; N/A | Must build |
| CIMD (spec SHOULD) | No (open issue) | Yes | N/A | Must build |
| New runtime dependency | None | Yes (no transitive deps) + KV | None | None |
| Work in Twiligent | Consent page, hook migration, JWKS verify | Authorize page, wrap fetch, KV binding | Table, UI, hashing | Large |
| Maturity | Beta | 1.x, maintained by Cloudflare | Simple | Yours to maintain |

### 4.6 Recommendation

**Primary: (a) Supabase OAuth 2.1 server + Custom Access Token Hook for `aud`, with the Worker as a resource server only. Secondary: (c) PATs for Claude Code, CI and as a fallback.** [Inference]

Why: it keeps the zero-dependency rule, reuses the user accounts and email sign-in Twiligent already has, keeps one identity system, and Supabase is already the trusted party for JWTs. The audience gap is closed by the hook; the Claude Code loopback gap is covered by PATs or `--callback-port` until Supabase merges #2871; CIMD is a SHOULD and Claude falls back to DCR. Revisit when Supabase ships #2894, #2871 and #2895. Choose (b) instead if the owner approves a dependency and wants zero client-side workarounds today.

Worker-side requirements for either OAuth choice [Fact-derived requirements, Inference for the shape]:

1. `GET /.well-known/oauth-protected-resource/mcp` (and the root variant) returning `{ "resource": "https://<api host>/mcp", "authorization_servers": ["https://<ref>.supabase.co/auth/v1"], "scopes_supported": [...], "bearer_methods_supported": ["header"] }`. `resource` must equal the URL users paste into Claude exactly.
2. Unauthenticated `POST /mcp` returns `401` with `WWW-Authenticate: Bearer resource_metadata="https://<api host>/.well-known/oauth-protected-resource/mcp"`.
3. Verify the JWT locally against cached JWKS with Web Crypto (no `jose` dependency needed; ES256 and RS256 are both in Web Crypto): signature, `iss`, `exp`, `aud` equals the MCP URL, `client_id` present. Take `userId` from `sub` only. Cache the JWKS in memory and in Redis, so verification is CPU-only and stays well inside 10 ms (inference, not measured).
4. Never forward the client's token to Instagram, YouTube or Cloudinary; use the stored per-user platform credentials as the existing services do.
5. Since Supabase has no custom scopes, model "read" vs "publish" permission in Twiligent itself (for example a per-grant setting the user picks on the consent page, stored by `client_id`, or simply write tools gated by confirmation). [Inference]

---

## 5. Hand-written JSON-RPC in Hono vs the SDK

Facts (npm, 2026-11-05; Context7 docs for `/modelcontextprotocol/typescript-sdk/v2.4.0`; Cloudflare docs):

- `@modelcontextprotocol/server` 2.4.0 depends on `zod ^4.2.0` and `@modelcontextprotocol/core` 2.4.0 (which itself depends on `zod`); unpacked size about 7.0 MB (core about 1.4 MB). It provides `createMcpHandler(factory)` that runs on web-standard runtimes (Workers, Deno, Bun), creates a fresh `McpServer` per request, and serves both 2026-07-28 and 2025-era clients. `@modelcontextprotocol/hono` 2.0.2 (peer deps `hono ^4.11.4`, server `^2.3.0`) adds `createMcpHonoApp` with JSON parsing and DNS rebinding protection. [Fact]
- The v1 package `@modelcontextprotocol/sdk` 1.32.2 pulls express, cors, ajv, jose, hono, eventsource and more. Not suitable for this Worker. [Fact for the list]
- Cloudflare `McpAgent` (Durable Object based) is now marked **deprecated and feature-frozen**; Cloudflare recommends the stateless `createMcpHandler` from `agents/mcp/server` (Agents SDK 0.20.0+ added 2026-07-28 support). On legacy clients the stateless handler gives "2025 wire compatibility without sessions"; GET and DELETE return 405; "Pushed elicitation, sampling, and roots requests fail immediately". The `agents` package (0.33.0) has many dependencies. [Fact, https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/ , .../agent-api/ , changelog 2026-07-27, npm]

Recommendation: **hand-write it.** [Inference]

- The surface for a tools-only, JSON-only, sessionless server is small: parse one JSON-RPC message, dispatch about six methods (section 2.3), validate the modern headers, return JSON. That is a route, a controller and a small `lib/mcp/` module of pure functions (envelope parsing, error builders, header checks), which Node tests can cover directly, matching Twiligent's layer rules.
- The SDK would add `zod` 4 and a multi-megabyte package to a Worker whose rule is zero extra runtime dependencies, and its tool input validation is zod-based, while Twiligent already has `backend/validators/`.
- Tool input schemas can be written as plain JSON Schema objects next to the existing validators (one source of truth per tool: a validator function plus its published schema; a test asserts they agree on sample inputs).
- Risk of hand-writing: protocol drift as the spec moves (it changed shape twice in 2025 to 2026). Mitigate with: a conformance test that drives the endpoint with the official client package as a **dev dependency only** (if the owner approves dev tooling), the MCP Inspector, and real Claude.ai and Claude Code connections before release.
- Choose the SDK instead only if you later need MRTR elicitation, `subscriptions/listen`, resources and prompts, or the tasks extension, where the protocol surface grows.

---

## 6. Production practices for Twiligent's tools

Each item says where it comes from.

### 6.1 Tool design

- Narrow, task-shaped tools, read separate from write, create/update/delete split (Anthropic review rules; Alloy; New Stack 1). Suggested first set [Inference]: `list_accounts`, `get_account_analytics`, `get_video_analytics`, `list_scheduled_posts`, `get_scheduled_post`, `schedule_instagram_post`, `update_scheduled_post`, `cancel_scheduled_post`, `create_media_upload` (returns a signed Cloudinary upload, never raw bytes through MCP), later `create_youtube_upload` plus `get_youtube_upload_status`.
- Names: snake_case, 64 characters or fewer, unique, stable (Anthropic review; spec name rules). Short server name too, because Claude Code builds `mcp__<server>__<tool>` and drops names over 128.
- Annotations on every tool: `title`; reads `readOnlyHint: true, openWorldHint: true` when they return platform content (Instagram, YouTube), `false` when they only read Twiligent's own tables; writes `readOnlyHint: false` with honest `destructiveHint` (cancel and delete true; schedule a new post false but see confirmation below) and `idempotentHint` (Spec defaults; MCP blog on annotations; Anthropic review).
- Descriptions: what the tool does, when to use it, units, limits, retention of any handle; no behavioral instructions (Anthropic review). Put cross-tool guidance ("use `list_accounts` to get an `account_id`") in server `instructions` and parameter descriptions as facts (Claude Code tool search note; Alloy hints).
- Server `instructions` under 4,096 characters (Claude Code limit).
- Deterministic `tools/list` order (spec SHOULD).

### 6.2 Inputs, outputs, size

- Validate every input server-side with the existing validators; return `isError: true` with a message that says what to fix, never a bare error (spec MUST; Anthropic review).
- `structuredContent` plus the same JSON serialized in a text block (spec SHOULD for backwards compatibility); add `outputSchema` for stable shapes.
- Pagination: `limit` (default 20, max 100) and opaque `cursor`; return `next_cursor` and a total when cheap (New Stack 2 and 10; Alloy).
- Size budget: target under about 10,000 tokens per result so Claude Code does not warn; hard cap well below claude.ai's ~150,000 characters and Claude Code's 25,000 tokens; when truncating, say what was cut and how to get the rest (Claude limits; Alloy). [Numbers are Inference from the stated limits]
- Dates in ISO 8601 with time zone; ids as strings.

### 6.3 Per-user rate limiting and timeouts

- Rate limit tool calls per user and per tool through the existing rate-limit middleware and Upstash scripts (spec MUST "Rate limit tool invocations"; Alloy; Mads Hansen expects 10x volume). Separate, tighter buckets for write tools and for upstream-heavy reads (Instagram and YouTube quotas). Return an `isError` result that says when to retry. Redis absent must fail open or to a conservative in-memory limit, per Twiligent's rule that the app works without Redis. [Inference for the bucket design]
- Timeouts: claude.ai waits 240 seconds per call. Workers free plan allows 10 ms CPU per request (paid default 30 s, max 5 min CPU), 50 subrequests per request on free, no hard wall-clock limit for HTTP requests (Fact, https://developers.cloudflare.com/workers/platform/limits/). Put an explicit timeout (for example 20 to 30 s) on every upstream fetch inside a tool and return a clear `isError` on timeout. Long work (YouTube upload processing) returns a job handle immediately plus a status tool; the job runs in the existing cron or queue path (spec "Stateful Tools" handle guidance). [Inference for numbers]
- On the free plan, keep per-call CPU low: local JWT verification with cached JWKS, no heavy JSON Schema engine, no large in-Worker transforms. [Inference]

### 6.4 Idempotency for write tools

- Agents retry and parallelize (New Stack 2). Give every create tool an optional `idempotency_key` string argument and also derive a server-side key from user id + tool + canonical args when absent; store key to result for 24 hours in Postgres (durable) or Redis (best effort) and return the original result on repeats. [Inference]
- Mark truly idempotent tools (`update_scheduled_post` with full replacement, `cancel_scheduled_post`) with `idempotentHint: true`.
- Twiligent already has a rule that an unknown-outcome private reply is never re-sent without a person's decision; apply the same rule to publishing: a publish whose outcome is unknown is never retried automatically by a tool call. [Inference, consistent with the project's CLAUDE.md]

### 6.5 Confirmation for destructive or public actions

Options:

1. **Client-side prompts from annotations:** Anthropic states destructive tools always prompt and read-only tools can auto-run (Fact, review criteria). Cheapest, but depends on the client and the user's "Always allow" choice.
2. **`_meta["anthropic/requiresUserInteraction"]: true`:** forces a prompt on every call in Claude Code, all modes (Fact). Not documented for claude.ai.
3. **Elicitation:** modern clients use MRTR (`input_required` + signed `requestState`); Claude Code supports form and URL elicitation (Fact); claude.ai support is undocumented. Legacy elicitation is a server-to-client request on the open SSE stream with the reply arriving as a separate POST, which a sessionless Worker cannot correlate reliably; Cloudflare's stateless handler simply fails such requests (Fact for Cloudflare's behavior; Inference for the general point).
4. **Two-step confirm token (works with every client):** `schedule_instagram_post` (or `cancel_...`) first returns a preview (account, caption, media, scheduled time, what will happen) plus a `confirmation_token`; a second call with that token executes. The token is HMAC-signed with a Worker secret and binds user id, tool, a digest of the arguments and a short expiry (for example 10 minutes), and is single-use, enforced server-side (same rules the spec gives for MRTR `requestState`). [Inference, modeled on the spec's MRTR security rules and New Stack 15 "dry-run ... return a diff"]

Recommendation [Inference]: annotations (1) on every tool, plus the two-step token (4) for anything public or irreversible (publish now, cancel, delete media, YouTube upload). Add `requiresUserInteraction` (2) for the execute step as a belt-and-braces measure in Claude Code. Add MRTR elicitation (3) later when claude.ai documents support.

### 6.6 Audit logging

- One row per tool call: id, user id, OAuth `client_id` or PAT id, tool name, argument digest (not raw captions or tokens), outcome (ok, isError, protocol error), error code, latency, upstream request ids, created_at. Retain for a fixed period. Writes never block the response (use `ctx.waitUntil`). (Alloy audit trails; New Stack 7; spec "Log tool usage for audit purposes" is a client SHOULD but equally useful server-side.) [Inference for the schema]
- Show recent MCP activity and connected clients in the dashboard with a revoke button (Supabase exposes grant management for OAuth clients, Fact per byo-mcp and Server SDK pages; PAT revoke is Twiligent's own).
- Never log access tokens, PATs, refresh tokens or Instagram access tokens (spec token theft section; Twiligent's `safeAccount()` rule).

### 6.7 Prompt injection from untrusted content

Instagram comments, captions, usernames, DMs, YouTube titles and descriptions are third-party text that will be read by the model.

- Mark such tools `openWorldHint: true`, which per the MCP blog tells clients to "Scrutinize output for untrusted content" (Fact, MCP blog).
- Return third-party text only in clearly named data fields in `structuredContent` (for example `comment.text`), never mixed into the tool's own explanatory sentences; cap length per item; strip control characters and zero-width characters; do not render it as markdown instructions. [Inference]
- Read tools never cause writes, and write tools always require the confirmation step, so injected text cannot publish or reply on its own. [Inference]
- Server descriptions and `instructions` must not tell the model to follow content found in results (Anthropic review). Spec MUST "Sanitize tool outputs" (Fact).
- Consider an explicit note in server `instructions` that comment and caption fields are user-generated content, phrased as a fact, not a command. [Inference]

### 6.8 Observability

- Structured logs per call with a correlation id (also returned in `_meta` of the result), tool name, user id hash, latency, outcome (New Stack 7). Workers Logs is enough to start. [Inference]
- 2026-07-28 documents OpenTelemetry trace context in `_meta` (`traceparent`, `tracestate`, `baggage`) (Fact, changelog minor item 2); read it if present and pass it to logs.
- Count per tool: calls, errors, p95 latency, rate-limit hits, confirm-token issued vs used. Alert on spikes in `isError` and 401s. [Inference]

### 6.9 Versioning and compatibility

- `serverInfo.version` follows the app's semantic version (New Stack 8). Add tools additively; never change a tool's meaning under the same name; ship a new name for breaking changes and keep the old one for a deprecation window. [Inference]
- Support legacy `2025-06-18` and `2025-11-25` (what Claude's hosted apps use) and modern `2026-07-28`; answer `initialize` with the client's version when supported, else the latest legacy one; answer unknown modern versions with `-32022` and the `supported` list. Decide whether to accept a missing `MCP-Protocol-Version` header as `2025-03-26` (spec MAY). (Facts from section 2; Inference for the policy.)
- Results on modern requests carry `resultType: "complete"`; list results carry `ttlMs` and `cacheScope` (`"private"` for per-user lists). (Fact, changelog major item 8 and minor item 5.)
- Tests with the MCP Inspector and real Claude clients before each release; fault injection for slow and failing upstreams (New Stack 11; Anthropic testing guidance).

### 6.10 Origin and CORS on the Worker

- Spec MUST validate `Origin`; if present and not allowed, `403` (Fact). Claude's hosted connections are server-to-server from Anthropic's cloud; I could not verify whether they send an `Origin` header. Allowlist the app origin and accept requests with no `Origin` (non-browser clients). [Inference]
- CORS is only needed for browser-based MCP clients such as the Inspector; keep it narrow. [Inference]

---

## 7. What I could not verify

- Whether claude.ai's hosted MCP client speaks the 2026-07-28 wire protocol or only legacy revisions (docs list only 2025-era auth specs). Plan for legacy.
- Whether claude.ai and Claude Desktop support elicitation (form or URL) for remote custom connectors. Not documented on the pages I read.
- Whether claude.ai's requests send an `Origin` header.
- End-to-end behavior of Supabase's OAuth server with claude.ai (DCR path) and with Claude Code using `--callback-port`. These are reasoned from docs and issues, not tested.
- Whether a Supabase Custom Access Token Hook that changes `aud` for OAuth tokens has side effects on Supabase's own APIs (PostgREST, Storage) for those tokens. Docs say the hook can set `aud`, nothing more.
- The `workers-oauth-provider` loopback any-port behavior and its refresh-token rotation (README did not state either), and current Cloudflare KV free-plan quotas.
- Bundled (minified) size of `@modelcontextprotocol/server` in a Worker; I only have npm unpacked sizes.
- The two dev.to articles were read through WebFetch's summarizer, so their points are paraphrased, not verbatim.

## 8. Sources

- Articles: https://runalloy.com/blog/building-production-ready-mcp-servers ; https://medium.com/@arifdewi/building-your-first-production-ready-mcp-server-a-weekend-project-that-actually-shipped-131305c69d54 ; https://dev.to/guang_diyuzhi_74b0fec2c09/mcp-in-production-is-the-model-context-protocol-ready-in-2026-5205 ; https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/ ; https://dev.to/mads_hansen_27b33ebfee4c9/mcp-in-production-what-nobody-tells-you-before-you-start-21m
- MCP spec: https://modelcontextprotocol.io/specification/versioning ; https://modelcontextprotocol.io/specification/2026-07-28/changelog ; .../2026-07-28/basic/transports ; .../2026-07-28/basic/transports/streamable-http ; .../2026-07-28/basic/versioning ; .../2026-07-28/server/discover ; .../2026-07-28/server/tools ; .../2026-07-28/basic/patterns/mrtr ; .../2026-07-28/basic/authorization (+ /authorization-server-discovery, /client-registration, /security-considerations) ; https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices ; https://modelcontextprotocol.io/specification/2025-11-25/basic/transports ; .../2025-11-25/basic/lifecycle ; https://modelcontextprotocol.io/specification/2025-06-18/schema ; https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations
- Anthropic: https://claude.com/docs/connectors/building ; https://claude.com/docs/connectors/building/authentication ; https://claude.com/docs/connectors/building/review-criteria ; https://claude.com/docs/connectors/custom/add-unlisted ; https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp ; https://code.claude.com/docs/en/mcp
- Supabase: https://supabase.com/docs/guides/auth/oauth-server ; .../oauth-server/getting-started ; .../oauth-server/oauth-flows ; .../oauth-server/mcp-authentication ; https://supabase.com/docs/guides/ai-tools/byo-mcp ; GitHub supabase/auth issues #2610, #2703, #2850 and PRs #2871, #2894, #2895 (state checked 2026-11-05)
- Cloudflare: https://github.com/cloudflare/workers-oauth-provider ; https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/ ; https://developers.cloudflare.com/agents/model-context-protocol/apis/agent-api/ ; https://developers.cloudflare.com/changelog/post/2026-07-27-agents-sdk-v0.20.0-mcp-sdk-v2/ ; https://developers.cloudflare.com/workers/platform/limits/
- MCP TypeScript SDK v2.4.0 docs via Context7 (`/modelcontextprotocol/typescript-sdk/v2.4.0`); npm registry (`npm view`) for versions and dependencies, 2026-11-05
