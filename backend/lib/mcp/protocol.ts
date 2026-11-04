// the Model Context Protocol's JSON-RPC envelope over Streamable HTTP, for a stateless, tools-only server that serves
// the handshake-based revisions Claude's hosted apps speak and the per-request revision 2026-07-28 on one endpoint

export const MODERN_VERSION = '2026-07-28';
// newest first; initialize answers with the client's version when it is one of these, otherwise the newest
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
export const SUPPORTED_VERSIONS: readonly string[] = [MODERN_VERSION, ...LEGACY_VERSIONS];
// the transport spec says a request with no version header comes from a 2025-03-26 client
const UNNAMED_LEGACY_VERSION = '2025-03-26';

const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

// JSON-RPC's own codes, then the two the MCP transport adds
export const RPC_ERROR = {
    parse: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internal: -32603,
    headerMismatch: -32020,
    unsupportedVersion: -32022,
} as const;

export type JsonRpcId = string | number;
export type JsonObject = Record<string, unknown>;

// a request has an id and expects a reply; a notification has none and gets 202
export interface RpcMessage {
    id: JsonRpcId | null;
    method: string;
    params: JsonObject;
}

export interface RpcError {
    code: number;
    message: string;
    data?: unknown;
}

export type RpcResponse =
    | { jsonrpc: '2.0'; id: JsonRpcId | null; result: unknown }
    | { jsonrpc: '2.0'; id: JsonRpcId | null; error: RpcError };

// what the endpoint sends back: the HTTP status and a JSON body, or none for an accepted notification
export interface McpReply {
    status: number;
    body: RpcResponse | null;
}

// legacy requests follow the initialize handshake's rules; modern ones carry their version in _meta and in headers
export type Era = { kind: 'legacy'; version: string } | { kind: 'modern'; version: string };

// the request headers the transport reads, already looked up by name; undefined when absent
export interface McpHeaders {
    protocolVersion?: string;
    method?: string;
    name?: string;
}

export interface ServerIdentity {
    name: string;
    title: string;
    version: string;
    instructions: string;
}

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resultReply(id: JsonRpcId | null, result: unknown, status = 200): McpReply {
    return { status, body: { jsonrpc: '2.0', id, result } };
}

export function errorReply(id: JsonRpcId | null, code: number, message: string, status: number, data?: unknown): McpReply {
    return { status, body: { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } } };
}

// one message per POST; batches were removed from the protocol in 2025-06-18, and clients never send responses
export function parseMessage(body: unknown): RpcMessage | McpReply {
    if (!isObject(body) || body.jsonrpc !== '2.0') {
        return errorReply(null, RPC_ERROR.invalidRequest, 'Send one JSON-RPC 2.0 request or notification per POST.', 400);
    }
    const { id, method, params } = body;
    const validId = id === undefined || typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
    if (typeof method !== 'string' || method === '' || !validId) {
        return errorReply(null, RPC_ERROR.invalidRequest, 'A JSON-RPC request needs a method name and a string or number id.', 400);
    }
    if (params !== undefined && !isObject(params)) {
        return errorReply(id ?? null, RPC_ERROR.invalidParams, 'params must be an object.', 400);
    }
    return { id: id ?? null, method, params: params ?? {} };
}

export function isReply(value: RpcMessage | McpReply): value is McpReply {
    return 'status' in value;
}

// a value the client could not send as a plain header arrives as =?base64?<value>?=
export function decodeHeaderValue(value: string): string | null {
    const encoded = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/i.exec(value);
    if (!encoded) return value;
    try {
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(Uint8Array.from(atob(encoded[1]), char => char.charCodeAt(0)));
    } catch {
        // not base64 or not UTF-8, so it cannot match anything in the body
        return null;
    }
}

// a request carrying the version in _meta is modern; anything else follows the version its header names
export function requestEra(message: RpcMessage, headers: McpHeaders): Era {
    const meta = isObject(message.params._meta) ? message.params._meta : {};
    const metaVersion = meta[META_VERSION];
    if (typeof metaVersion === 'string') return { kind: 'modern', version: metaVersion };
    return { kind: 'legacy', version: headers.protocolVersion ?? UNNAMED_LEGACY_VERSION };
}

// what makes a request unusable before its method runs: an unknown version, or headers that disagree with the body
export function checkEnvelope(message: RpcMessage, era: Era, headers: McpHeaders): McpReply | null {
    if (era.kind === 'legacy') {
        // initialize names its version in the body and is answered with one we support, so only later requests are checked
        if (message.method === 'initialize' || (LEGACY_VERSIONS as readonly string[]).includes(era.version)) return null;
        return unsupportedVersion(message.id, era.version);
    }
    if (era.version !== MODERN_VERSION) return unsupportedVersion(message.id, era.version);
    if (headers.protocolVersion !== era.version) return headerMismatch(message.id, 'MCP-Protocol-Version', headers.protocolVersion, era.version);
    if (message.id !== null && headers.method !== message.method) return headerMismatch(message.id, 'Mcp-Method', headers.method, message.method);
    if (message.method === 'tools/call') {
        const name = typeof message.params.name === 'string' ? message.params.name : undefined;
        const sent = headers.name === undefined ? undefined : decodeHeaderValue(headers.name) ?? undefined;
        if (sent !== name) return headerMismatch(message.id, 'Mcp-Name', headers.name, name);
    }
    return null;
}

function unsupportedVersion(id: JsonRpcId | null, requested: string): McpReply {
    return errorReply(id, RPC_ERROR.unsupportedVersion, 'Unsupported protocol version', 400, { supported: SUPPORTED_VERSIONS, requested });
}

function headerMismatch(id: JsonRpcId | null, header: string, sent: string | undefined, expected: string | undefined): McpReply {
    const message = sent === undefined
        ? `Header mismatch: the ${header} header is missing`
        : `Header mismatch: ${header} header value '${sent}' does not match body value '${expected ?? ''}'`;
    return errorReply(id, RPC_ERROR.headerMismatch, message, 400);
}

// modern servers answer an unknown method with 404 so intermediaries can tell it apart from a bad request
export function methodNotFound(message: RpcMessage, era: Era): McpReply {
    return errorReply(message.id, RPC_ERROR.methodNotFound, `Unknown method: ${message.method}`, era.kind === 'modern' ? 404 : 200);
}

export function negotiateLegacyVersion(requested: unknown): string {
    return typeof requested === 'string' && (LEGACY_VERSIONS as readonly string[]).includes(requested) ? requested : LEGACY_VERSIONS[0];
}

export function initializeResult(params: JsonObject, server: ServerIdentity): JsonObject {
    return {
        protocolVersion: negotiateLegacyVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: server.name, title: server.title, version: server.version },
        instructions: server.instructions,
    };
}

// cached privately per client for an hour: the tool list depends on what the caller is allowed to do
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export function discoverResult(server: ServerIdentity): JsonObject {
    return {
        resultType: 'complete',
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: { tools: {} },
        _meta: { [META_SERVER_INFO]: { name: server.name, title: server.title, version: server.version } },
        instructions: server.instructions,
        ttlMs: DISCOVERY_TTL_MS,
        cacheScope: 'private',
    };
}

// modern results say they are complete, and list results say how long and for whom they may be cached
export function eraResult(era: Era, result: JsonObject, cacheable = false): JsonObject {
    if (era.kind === 'legacy') return result;
    return cacheable ? { resultType: 'complete', ...result, ttlMs: DISCOVERY_TTL_MS, cacheScope: 'private' } : { resultType: 'complete', ...result };
}
