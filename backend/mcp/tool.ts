import type { Services } from '../container.ts';
import type { McpPrincipal } from '../services/mcpAccessService.ts';
import type { Fields } from '../validators/fields.ts';
import type { McpPermission } from '../../shared/types/mcp.ts';

// a JSON Schema object as tools/list publishes it; the parse function is what actually enforces it
export type JsonSchema = Record<string, unknown>;

// hints for the client; the server enforces permission and confirmation itself and never relies on them
export interface ToolAnnotations {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    // true when the result holds text other people wrote, such as captions, titles and comments
    openWorldHint: boolean;
}

export interface ToolContext {
    services: Services;
    principal: McpPrincipal;
}

// one MCP tool: what it is called, what it accepts, and the single service call it makes
export interface McpTool<Input> {
    name: string;
    title: string;
    description: string;
    inputSchema: JsonSchema;
    annotations: ToolAnnotations;
    permission: McpPermission;
    // irreversible or public actions run only on a second call carrying the confirmation token from the first
    needsConfirmation?(input: Input): boolean;
    // what the person is asked to confirm, in one plain sentence
    describe?(input: Input): string;
    // the same validators the REST API uses; a ValidationError becomes a tool error the model can correct
    parse(args: Fields): Input;
    run(input: Input, context: ToolContext): Promise<unknown>;
}

// method signatures let a tool for one input type sit in a list of McpTool<unknown>; parse is what makes the input safe
export type AnyTool = McpTool<unknown>;

export function defineTool<Input>(tool: McpTool<Input>): AnyTool {
    return tool;
}

export const READ_ONLY: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

// a list result holds at most this many items, with a cursor for the rest, so one call stays far below the
// 25,000 token limit Claude Code puts on a tool result
export const MAX_PAGE_SIZE = 50;

export function noInput(): JsonSchema {
    return { type: 'object', properties: {}, additionalProperties: false };
}
