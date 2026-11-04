import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RESULT_CHARS, createMcpService } from '../../services/mcpService.ts';
import { createAuditRepository } from '../../repositories/auditRepository.ts';
import { readMcpConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import { NotFoundError, ValidationError } from '../../lib/errors.ts';
import { MODERN_VERSION } from '../../lib/mcp/protocol.ts';
import { READ_ONLY, defineTool, noInput } from '../../mcp/tool.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';
import type { Services } from '../../container.ts';
import type { McpPermission } from '../../../shared/types/mcp.ts';
import type { Env } from '../../types/env.ts';

const SECRET = 'k'.repeat(40);
const ran: string[] = [];

const readTool = defineTool<Record<string, never>>({
    name: 'read_thing', title: 'Read a thing', description: 'Reads.', inputSchema: noInput(), annotations: READ_ONLY, permission: 'read',
    parse: () => ({}),
    run: async () => ({ ok: true }),
});

const deleteTool = defineTool<{ id: string }>({
    name: 'delete_thing', title: 'Delete a thing', description: 'Deletes.', inputSchema: noInput(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }, permission: 'write',
    needsConfirmation: () => true,
    describe: ({ id }) => `Delete ${id}.`,
    parse(args) {
        if (typeof args.id !== 'string') throw new ValidationError('id is required');
        return { id: args.id };
    },
    async run({ id }) {
        if (id === 'missing') throw new NotFoundError('No thing with that id.');
        if (id === 'boom') throw new Error('database password is hunter2');
        if (id === 'huge') return { text: 'x'.repeat(MAX_RESULT_CHARS) };
        ran.push(id);
        return { deleted: id };
    },
});

function setup(permission: McpPermission = 'write', env: Partial<Env> = { TOKEN_ENCRYPTION_KEY: SECRET }) {
    const db = fakeSupabase();
    const service = createMcpService({
        tools: [readTool, deleteTool],
        services: {} as Services,
        principal: { userId: 'user-1', permission, via: 'token:t1' },
        audit: createAuditRepository(db),
        config: readMcpConfig(env as Env),
        server: { name: 'twiligent', title: 'Twiligent', version: '2.0.0', instructions: 'Use the tools.' },
        context: { requestId: 'req-42', signal: new AbortController().signal, log: createLogger() },
    });
    const call = (name: string, args: Record<string, unknown> = {}) => service.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, {});
    return { db, service, call };
}

function result(reply: { body: unknown }): Record<string, unknown> {
    return (reply.body as { result: Record<string, unknown> }).result;
}

function text(reply: { body: unknown }): string {
    return (result(reply).content as { text: string }[])[0].text;
}

test('a read-only caller sees only read tools and is told how to allow changes when it calls a write tool', async () => {
    const { service, call } = setup('read');
    const list = await service.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
    assert.deepEqual((result(list).tools as { name: string }[]).map(tool => tool.name), ['read_thing']);
    const reply = await call('delete_thing', { id: 'a' });
    assert.equal(result(reply).isError, true);
    assert.match(text(reply), /may only read/);
});

test('a write tool that needs confirmation runs only on a second call carrying the token for the same arguments', async () => {
    const { call, db } = setup();
    const first = await call('delete_thing', { id: 'a' });
    const pending = result(first).structuredContent as { status: string; action: string; confirmationToken: string };
    assert.equal(pending.status, 'confirmation_required');
    assert.equal(pending.action, 'Delete a.');
    assert.deepEqual(ran, []);

    const other = await call('delete_thing', { id: 'b', confirmationToken: pending.confirmationToken });
    assert.equal((result(other).structuredContent as { status: string }).status, 'confirmation_required');
    assert.deepEqual(ran, []);

    const confirmed = await call('delete_thing', { id: 'a', confirmationToken: pending.confirmationToken });
    assert.deepEqual(result(confirmed).structuredContent, { deleted: 'a' });
    assert.deepEqual(ran, ['a']);
    assert.deepEqual(db.table.filter(row => row._table === 'audit_events').map(row => row.action), ['mcp_access_token.called_tool']);
});

test('without a signing secret a tool that needs confirmation refuses instead of running', async () => {
    const { call } = setup('write', {});
    const reply = await call('delete_thing', { id: 'a' });
    assert.equal(result(reply).isError, true);
    assert.match(text(reply), /TOKEN_ENCRYPTION_KEY/);
});

test('bad input and app errors come back as tool errors the model can act on; other errors never leak their message', async () => {
    const { call } = setup();
    assert.equal(text(await call('delete_thing', {})), 'id is required');
    const confirmedCall = async (id: string) => {
        const first = await call('delete_thing', { id });
        const token = (result(first).structuredContent as { confirmationToken: string }).confirmationToken;
        return call('delete_thing', { id, confirmationToken: token });
    };
    assert.equal(text(await confirmedCall('missing')), 'No thing with that id.');
    const boom = await confirmedCall('boom');
    assert.equal(result(boom).isError, true);
    assert.doesNotMatch(text(boom), /hunter2/);
    assert.match(text(boom), /req-42/);
    assert.match(text(await confirmedCall('huge')), /too large/);
});

test('an unknown tool or non-object arguments are protocol errors', async () => {
    const { service, call } = setup();
    const unknown = await call('nope');
    assert.equal((unknown.body as { error: { code: number } }).error.code, -32602);
    const bad = await service.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_thing', arguments: [1] } }, {});
    assert.equal((bad.body as { error: { code: number } }).error.code, -32602);
});

test('initialize, ping and notifications work for legacy clients without any session', async () => {
    const { service } = setup();
    const init = await service.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, {});
    assert.equal(result(init).protocolVersion, '2025-11-25');
    assert.deepEqual(result(await service.handle({ jsonrpc: '2.0', id: 2, method: 'ping' }, { protocolVersion: '2025-11-25' })), {});
    const note = await service.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, { protocolVersion: '2025-11-25' });
    assert.deepEqual(note, { status: 202, body: null });
});

test('a modern call is served statelessly and marked complete', async () => {
    const { service } = setup();
    const meta = { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_VERSION } };
    const reply = await service.handle(
        { jsonrpc: '2.0', id: 'a', method: 'tools/call', params: { name: 'read_thing', arguments: {}, ...meta } },
        { protocolVersion: MODERN_VERSION, method: 'tools/call', name: 'read_thing' },
    );
    assert.equal(reply.status, 200);
    assert.equal(result(reply).resultType, 'complete');
    assert.deepEqual(result(reply).structuredContent, { ok: true });
});
