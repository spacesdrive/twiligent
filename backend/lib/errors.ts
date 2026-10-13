import { redactUrls } from './redact.ts';
import type { ApiErrorCode } from '../../shared/types/domain.ts';

// services throw these; middleware/errorHandler.ts maps each code to a status and the one error body
export class AppError extends Error {
    readonly code: ApiErrorCode;

    constructor(code: ApiErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
        this.code = code;
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super('VALIDATION_ERROR', message);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string) {
        super('UNAUTHORIZED', message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super('FORBIDDEN', message);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string) {
        super('NOT_FOUND', message);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super('CONFLICT', message);
    }
}

// a daily allowance is used up; the per-request rate limiter answers its own 429s with retryAfter
export class RateLimitedError extends AppError {
    constructor(message: string) {
        super('RATE_LIMITED', message);
    }
}

export class NotConfiguredError extends AppError {
    constructor(message: string) {
        super('NOT_CONFIGURED', message);
    }
}

export interface UpstreamDetails {
    // the platform's own error reason, such as YouTube's playlistNotFound
    reason?: string;
    status?: number;
    cause?: unknown;
}

// keeps the platform's wording, which users can act on, but never a url that may carry a key or token
export class UpstreamError extends AppError {
    readonly reason: string;
    readonly upstreamStatus: number | undefined;

    constructor(message: string, { reason = '', status, cause }: UpstreamDetails = {}) {
        super('UPSTREAM_ERROR', redactUrls(message), { cause });
        this.reason = reason;
        this.upstreamStatus = status;
    }
}

export class UpstreamTimeoutError extends AppError {
    constructor(platform: string, cause?: unknown) {
        super('UPSTREAM_TIMEOUT', `${platform} took too long to answer. Try again in a moment.`, { cause });
    }
}

// the driver's message can name tables and constraints, so it goes to the log and the client gets a plain one
export class DatabaseError extends AppError {
    readonly operation: string;

    constructor(operation: string, cause: unknown) {
        super('DATABASE_ERROR', 'The database request failed. Try again in a moment.', { cause });
        this.operation = operation;
    }
}

export function isAbortError(err: unknown): boolean {
    const name = (err as Error | undefined)?.name;
    return name === 'AbortError' || name === 'TimeoutError';
}
