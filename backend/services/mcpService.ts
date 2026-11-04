import {
    RPC_ERROR, checkEnvelope, discoverResult, eraResult, errorReply, initializeResult, isReply, methodNotFound, parseMessage,
    requestEra, resultReply,
} from '../lib/mcp/protocol.ts';
import { CONFIRMATION_TTL_MS, createConfirmation, verifyConfirmation } from '../lib/mcp/confirmation.ts';
import { canWrite } from '../lib/mcp/accessToken.ts';
import { AppError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import type { Era, JsonObject, McpHeaders, McpReply, RpcMessage, ServerIdentity } from '../lib/mcp/protocol.ts';
import type { AnyTool } from '../mcp/tool.ts';
import type { Services } from '../container.ts';
import type { McpPrincipal } from './mcpAccessService.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { McpConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';

export interface McpServiceDeps {
    tools: readonly AnyTool[];
    services: Services;
    principal: McpPrincipal;
    audit: AuditRepository;
    config: McpConfig;
    server: ServerIdentity;
    context: RequestContext;
}

export interface McpService {
    handle(body: unknown, headers: McpHeaders): Promise<McpReply>;
}

// a tool past this has stalled on a platform; Claude's own limit is 240 seconds and the Worker's request deadline 30
const TOOL_TIMEOUT_MS = 25_000;
// about 10,000 tokens, where Claude Code starts warning; list tools page well below it
export const MAX_RESULT_CHARS = 40_000;

class ToolTimeoutError extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ToolTimeoutError()), ms);
    });
    return Promise.race([work, timeout]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
    });
}

function toolResult(era: Era, structured: unknown, isError = false): JsonObject {
    const text = typeof structured === 'string' ? structured : JSON.stringify(structured);
    const result: JsonObject = { content: [{ type: 'text', text }], isError };
    if (!isError && typeof structured === 'object' && structured !== null && !Array.isArray(structured)) result.structuredContent = structured;
    return eraResult(era, result);
}

function toolError(era: Era, message: string): JsonObject {
    return toolResult(era, message, true);
}

function definition(tool: AnyTool): JsonObject {
    return { name: tool.name, title: tool.title, description: tool.description, inputSchema: tool.inputSchema, annotations: { title: tool.title, ...tool.annotations } };
}

// one JSON-RPC request in, one reply out; tools see only the caller's own data through the same services the app uses
export function createMcpService({ tools, services, principal, audit, config, server, context }: McpServiceDeps): McpService {
    const { log } = context;
    const visible = tools.filter(tool => tool.permission === 'read' || canWrite(principal.permission));

    async function record(tool: AnyTool, outcome: string): Promise<void> {
        const subjectType = principal.via.startsWith('token:') ? 'mcp_access_token' : 'mcp_client';
        try {
            await audit.recordForUser(principal.userId, {
                action: `${subjectType}.called_tool`, subjectType, subjectId: principal.via.slice(principal.via.indexOf(':') + 1), details: { tool: tool.name, outcome },
            });
        } catch (err) {
            log.warn('could not record an MCP tool call', { tool: tool.name, ...errorFields(err) });
        }
    }

    // the first call returns what will happen and a token; only a second call with the same arguments and that token runs it
    async function confirmation(tool: AnyTool, input: unknown, args: JsonObject, era: Era): Promise<JsonObject | null> {
        if (!tool.needsConfirmation?.(input)) return null;
        const secret = config.signingSecret;
        if (!secret) return toolError(era, 'This action needs a confirmation, which the server cannot sign until its owner sets the TOKEN_ENCRYPTION_KEY Worker secret.');
        const subject = { userId: principal.userId, tool: tool.name, args };
        if (await verifyConfirmation(args.confirmationToken, subject, secret)) return null;
        return toolResult(era, {
            status: 'confirmation_required',
            action: tool.describe?.(input) ?? `Run ${tool.title}`,
            confirmationToken: await createConfirmation(subject, secret),
            expiresInSeconds: CONFIRMATION_TTL_MS / 1000,
            instructions: 'Show the action to the person. Only if they agree, call this tool again with the same arguments plus confirmationToken.',
        });
    }

    async function callTool(message: RpcMessage, era: Era): Promise<McpReply> {
        const { name, arguments: rawArgs = {} } = message.params;
        if (typeof name !== 'string') return errorReply(message.id, RPC_ERROR.invalidParams, 'tools/call needs the tool name in params.name.', era.kind === 'modern' ? 400 : 200);
        if (typeof rawArgs !== 'object' || rawArgs === null || Array.isArray(rawArgs)) {
            return errorReply(message.id, RPC_ERROR.invalidParams, 'Tool arguments must be an object.', era.kind === 'modern' ? 400 : 200);
        }
        const args = rawArgs as JsonObject;
        const tool = visible.find(candidate => candidate.name === name);
        if (!tool) {
            const hidden = tools.some(candidate => candidate.name === name);
            if (hidden) return resultReply(message.id, toolError(era, 'This connection may only read. To let Claude make changes, allow changes for this client or token in Twiligent, Settings, Claude.'));
            return errorReply(message.id, RPC_ERROR.invalidParams, `Unknown tool: ${name}`, era.kind === 'modern' ? 400 : 200);
        }

        let input: unknown;
        try {
            input = tool.parse(args);
        } catch (err) {
            if (err instanceof AppError) return resultReply(message.id, toolError(era, err.message));
            throw err;
        }

        const pending = await confirmation(tool, input, args, era);
        if (pending) return resultReply(message.id, pending);

        try {
            const structured = await withTimeout(tool.run(input, { services, principal }), TOOL_TIMEOUT_MS);
            const result = toolResult(era, structured);
            const size = JSON.stringify(result.content).length;
            if (size > MAX_RESULT_CHARS) return resultReply(message.id, toolError(era, 'The result is too large to return at once. Ask for fewer items with limit, or narrow the request.'));
            if (tool.permission === 'write') await record(tool, 'done');
            return resultReply(message.id, result);
        } catch (err) {
            if (tool.permission === 'write') await record(tool, 'failed');
            if (err instanceof AppError) return resultReply(message.id, toolError(era, err.message));
            if (err instanceof ToolTimeoutError) return resultReply(message.id, toolError(era, 'The tool took too long and was stopped. Check whether the change happened before trying again.'));
            log.error('mcp tool failed', { tool: tool.name, ...errorFields(err) });
            return resultReply(message.id, toolError(era, `The tool failed unexpectedly. Quote request id ${context.requestId} when reporting it.`));
        }
    }

    return {
        async handle(body, headers) {
            const parsed = parseMessage(body);
            if (isReply(parsed)) return parsed;
            const era = requestEra(parsed, headers);
            const refused = checkEnvelope(parsed, era, headers);
            if (refused) return refused;
            // a notification needs no answer, and this server keeps no state for one to change
            if (parsed.id === null) return { status: 202, body: null };

            switch (parsed.method) {
                case 'initialize':
                    return resultReply(parsed.id, initializeResult(parsed.params, server));
                case 'ping':
                    return resultReply(parsed.id, eraResult(era, {}));
                case 'server/discover':
                    return resultReply(parsed.id, discoverResult(server));
                case 'tools/list':
                    return resultReply(parsed.id, eraResult(era, { tools: visible.map(definition) }, true));
                case 'tools/call':
                    return callTool(parsed, era);
                default:
                    return methodNotFound(parsed, era);
            }
        },
    };
}
