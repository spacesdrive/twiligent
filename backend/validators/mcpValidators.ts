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

export interface ClientApprovalInput {
    clientId: string;
    clientName: string;
    permission: McpPermission;
}

const MAX_CLIENT_NAME_LENGTH = 200;

// the consent page sends what Supabase Auth told it about the client; the approval only ever applies to the caller
export function parseClientApproval(body: Fields): ClientApprovalInput {
    const clientId = requiredString(body, 'clientId', 'clientId is required').trim();
    if (clientId.length === 0 || clientId.length > 200) throw new ValidationError('clientId must be 1 to 200 characters');
    const clientName = requiredString(body, 'clientName', 'clientName is required').trim().slice(0, MAX_CLIENT_NAME_LENGTH) || 'Claude';
    return { clientId, clientName, permission: parsePermission(body.permission) };
}
