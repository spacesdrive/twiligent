import { MAX_PAGE_SIZE } from './tool.ts';
import { ValidationError } from '../lib/errors.ts';
import { optionalNumber, optionalString } from '../validators/fields.ts';
import type { JsonSchema } from './tool.ts';
import type { Fields } from '../validators/fields.ts';

// building blocks for the JSON Schemas tools/list publishes; the validators enforce the same rules on every call

export function objectSchema(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
    return { type: 'object', properties, required, additionalProperties: false };
}

export const idProperty = (what: string): JsonSchema => ({ type: 'string', minLength: 1, maxLength: 100, description: `The ${what} id, as a list tool returned it` });

export const pageProperties: Record<string, JsonSchema> = {
    limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, description: `How many items to return, ${MAX_PAGE_SIZE} at most (default 20)` },
    cursor: { type: 'string', description: 'The nextCursor from the previous page, to continue the list' },
};

// added to the schema of every tool that asks for a confirmation first
export const confirmationProperty: JsonSchema = {
    type: 'string',
    description: 'Leave out on the first call. The first call returns a confirmationToken; send it back only after the person agreed to the action it describes.',
};

export function withConfirmation(schema: JsonSchema): JsonSchema {
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    return { ...schema, properties: { ...properties, confirmationToken: confirmationProperty } };
}

const DEFAULT_PAGE_SIZE = 20;

export interface Page {
    limit: number;
    offset: number;
}

// the cursor is the position of the next item; it carries no data, so a forged one only skips items the caller owns
export function parsePage(fields: Fields): Page {
    const limit = optionalNumber(fields, 'limit') ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) throw new ValidationError(`limit must be a whole number from 1 to ${MAX_PAGE_SIZE}`);
    const cursor = optionalString(fields, 'cursor');
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isInteger(offset) || offset < 0) throw new ValidationError('cursor must be the nextCursor a previous page returned');
    return { limit, offset };
}

export function pageOf<T>(items: T[], { limit, offset }: Page): { items: T[]; nextCursor: string | null; total: number } {
    const end = offset + limit;
    return { items: items.slice(offset, end), nextCursor: end < items.length ? String(end) : null, total: items.length };
}

export function requiredId(fields: Fields, name: string, what: string): string {
    const value = fields[name];
    if (typeof value !== 'string' || value.trim() === '' || value.length > 100) throw new ValidationError(`${name} must be the ${what} id a list tool returned`);
    return value.trim();
}
