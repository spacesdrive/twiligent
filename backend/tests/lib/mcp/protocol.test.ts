import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    MODERN_VERSION, RPC_ERROR, checkEnvelope, decodeHeaderValue, discoverResult, eraResult, initializeResult, isReply,
    methodNotFound, parseMessage, requestEra,
} from '../../../lib/mcp/protocol.ts';
import type { McpHeaders, McpReply, RpcMessage } from '../../../lib/mcp/protocol.ts';

const SERVER = { name: 'twiligent', title: 'Twiligent', version: '2.0.0', instructions: 'Use the tools.' };
const MODERN_META = { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_VERSION } };

function message(body: unknown): RpcMessage {
    const parsed = parseMessage(body);
    if (isReply(parsed)) throw new Error('expected a message');
    return parsed;
}

function errorCode(reply: McpReply | null): number | undefined {
    return reply?.body && 'error' in reply.body ? reply.body.error.code : undefined;
}

test('a request keeps its id, method and params, and a notification has a null id', () => {
    assert.deepEqual(message({ jsonrpc: '2.0', id: 7, method: 'tools/list' }), { id: 7, method: 'tools/list', params: {} });
    assert.equal(message({ jsonrpc: '2.0', method: 'notifications/initialized' }).id, null);
});

test('a batch, a response or a body without a method is refused as an invalid request', () => {
    for (const body of [[{ jsonrpc: '2.0', id: 1, method: 'ping' }], { jsonrpc: '2.0', id: 1, result: {} }, { id: 1, method: 'ping' }, 'ping']) {
        const parsed = parseMessage(body);
        assert.ok(isReply(parsed));
        assert.equal(parsed.status, 400);
        assert.equal(errorCode(parsed), RPC_ERROR.invalidRequest);
    }
});

test('params that are not an object are invalid params', () => {
    const parsed = parseMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: ['x'] });
    assert.ok(isReply(parsed));
    assert.equal(errorCode(parsed), RPC_ERROR.invalidParams);
});

test('a request with the version in _meta is modern; one without follows its header or 2025-03-26', () => {
    const modern = message({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: MODERN_META });
    assert.deepEqual(requestEra(modern, {}), { kind: 'modern', version: MODERN_VERSION });
    const legacy = message({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.deepEqual(requestEra(legacy, { protocolVersion: '2025-11-25' }), { kind: 'legacy', version: '2025-11-25' });
    assert.deepEqual(requestEra(legacy, {}), { kind: 'legacy', version: '2025-03-26' });
});

test('a modern request needs headers that match its body', () => {
    const call = message({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_accounts', ...MODERN_META } });
    const era = requestEra(call, {});
    const good: McpHeaders = { protocolVersion: MODERN_VERSION, method: 'tools/call', name: 'list_accounts' };
    assert.equal(checkEnvelope(call, era, good), null);
    for (const headers of [{ ...good, protocolVersion: undefined }, { ...good, method: 'tools/list' }, { ...good, name: 'delete_media' }, { ...good, name: undefined }]) {
        const reply = checkEnvelope(call, era, headers);
        assert.equal(reply?.status, 400);
        assert.equal(errorCode(reply), RPC_ERROR.headerMismatch);
    }
});

test('a tool name sent base64 encoded in Mcp-Name is decoded before it is compared', () => {
    assert.equal(decodeHeaderValue(`=?base64?${btoa('list_accounts')}?=`), 'list_accounts');
    assert.equal(decodeHeaderValue('list_accounts'), 'list_accounts');
    assert.equal(decodeHeaderValue('=?base64?***?='), '=?base64?***?=');
    const call = message({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_accounts', ...MODERN_META } });
    const headers = { protocolVersion: MODERN_VERSION, method: 'tools/call', name: `=?base64?${btoa('list_accounts')}?=` };
    assert.equal(checkEnvelope(call, requestEra(call, {}), headers), null);
});

test('an unknown version is refused with the versions the server supports', () => {
    const modern = message({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } } });
    const reply = checkEnvelope(modern, requestEra(modern, {}), { protocolVersion: '1900-01-01', method: 'tools/list' });
    assert.equal(reply?.status, 400);
    assert.equal(errorCode(reply), RPC_ERROR.unsupportedVersion);
    const legacy = message({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.equal(errorCode(checkEnvelope(legacy, requestEra(legacy, { protocolVersion: '2024-01-01' }), { protocolVersion: '2024-01-01' })), RPC_ERROR.unsupportedVersion);
});

test('initialize answers with the client version when supported, otherwise the newest legacy version, and no session', () => {
    assert.equal(initializeResult({ protocolVersion: '2025-06-18' }, SERVER).protocolVersion, '2025-06-18');
    assert.equal(initializeResult({ protocolVersion: '2099-01-01' }, SERVER).protocolVersion, '2025-11-25');
    assert.deepEqual(initializeResult({}, SERVER).capabilities, { tools: { listChanged: false } });
    const init = message({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2099-01-01' } });
    assert.equal(checkEnvelope(init, requestEra(init, {}), {}), null);
});

test('discovery lists every supported version and is cached privately', () => {
    const result = discoverResult(SERVER);
    assert.deepEqual(result.supportedVersions, ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26']);
    assert.equal(result.cacheScope, 'private');
    assert.equal(result.resultType, 'complete');
});

test('modern results are marked complete and legacy results are left as they are', () => {
    assert.deepEqual(eraResult({ kind: 'legacy', version: '2025-11-25' }, { tools: [] }), { tools: [] });
    assert.deepEqual(eraResult({ kind: 'modern', version: MODERN_VERSION }, { content: [] }), { resultType: 'complete', content: [] });
    assert.equal(eraResult({ kind: 'modern', version: MODERN_VERSION }, { tools: [] }, true).cacheScope, 'private');
});

test('an unknown method is a 404 for modern clients and a JSON-RPC error with 200 for legacy ones', () => {
    const unknown = message({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    assert.equal(methodNotFound(unknown, { kind: 'modern', version: MODERN_VERSION }).status, 404);
    const legacy = methodNotFound(unknown, { kind: 'legacy', version: '2025-11-25' });
    assert.equal(legacy.status, 200);
    assert.equal(errorCode(legacy), RPC_ERROR.methodNotFound);
});
