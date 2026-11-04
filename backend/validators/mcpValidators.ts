import { ValidationError } from '../lib/errors.ts';
import { optionalNumber, requiredString } from './fields.ts';
import type { Fields } from './fields.ts';
import type { McpAccessTokenCreateRequest, McpPermission } from '../../shared/types/mcp.ts';

const MAX_LABEL_LENGTH = 80;
// a year at most, so a forgotten token stops working on its own
const MAX_EXPIRY_DAYS = 365;

export function parsePermission(value: unknown): McpPermission {
    if (value === 'read' || value === 'write') return value;
    throw new ValidationError('Choose what the token may do: read, or read and make changes');
}

export function parseAccessTokenCreate(body: Fields): McpAccessTokenCreateRequest {
    const label = requiredString(body, 'label', 'Give the token a name, such as the computer it is for').trim();
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH) throw new ValidationError(`The name must be 1 to ${MAX_LABEL_LENGTH} characters`);
    const expiresInDays = body.expiresInDays === null ? null : optionalNumber(body, 'expiresInDays') ?? null;
    if (expiresInDays !== null && (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > MAX_EXPIRY_DAYS)) {
        throw new ValidationError(`Expiry must be a whole number of days from 1 to ${MAX_EXPIRY_DAYS}, or never`);
    }
    return { label, permission: parsePermission(body.permission), expiresInDays };
}
