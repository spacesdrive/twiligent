import { ValidationError } from '../lib/errors.ts';

export type Fields = Record<string, unknown>;

export function objectBody(value: unknown): Fields {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ValidationError('The request body must be a JSON object');
    }
    return value as Fields;
}

function isMissing(value: unknown): value is null | undefined {
    return value === undefined || value === null;
}

// trimmed; an empty or blank value counts as missing
export function requiredString(fields: Fields, name: string, message = `${name} is required`): string {
    const value = optionalString(fields, name);
    if (!value) throw new ValidationError(message);
    return value;
}

export function optionalString(fields: Fields, name: string): string | undefined {
    const value = fields[name];
    if (isMissing(value)) return undefined;
    if (typeof value !== 'string') throw new ValidationError(`${name} must be text`);
    return value.trim();
}

export function optionalBoolean(fields: Fields, name: string): boolean | undefined {
    const value = fields[name];
    if (isMissing(value)) return undefined;
    if (typeof value !== 'boolean') throw new ValidationError(`${name} must be true or false`);
    return value;
}

export function optionalNumber(fields: Fields, name: string): number | undefined {
    const value = fields[name];
    if (isMissing(value)) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError(`${name} must be a number`);
    return value;
}

export function optionalArray<T>(fields: Fields, name: string, isItem: (item: unknown) => item is T, itemDescription: string): T[] | undefined {
    const value = fields[name];
    if (isMissing(value)) return undefined;
    if (!Array.isArray(value) || !value.every(isItem)) throw new ValidationError(`${name} must be a list of ${itemDescription}`);
    return value;
}

export function isString(item: unknown): item is string {
    return typeof item === 'string';
}

export function isObject(item: unknown): item is Fields {
    return typeof item === 'object' && item !== null && !Array.isArray(item);
}

// a field the client may send as a value, as null to clear it, or leave out to keep it
export function presentField(fields: Fields, name: string): boolean {
    return Object.prototype.hasOwnProperty.call(fields, name) && fields[name] !== undefined;
}
