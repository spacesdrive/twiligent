import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import { requestLogger } from './requestContext.ts';
import type { AppContext } from '../types/app.ts';
import type { ApiErrorCode, ApiFailure } from '../../shared/types/domain.ts';
import type { AuthHookFailure } from '../types/authHook.ts';

const STATUS_BY_CODE: Record<ApiErrorCode, ContentfulStatusCode> = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    UPSTREAM_ERROR: 502,
    UPSTREAM_TIMEOUT: 504,
    NOT_CONFIGURED: 503,
    DATABASE_ERROR: 500,
    INTERNAL_ERROR: 500,
};

const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
    400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED',
};

const INTERNAL_MESSAGE = 'The server could not complete the request. Try again, and quote the request id if it keeps failing.';

export function statusOf(code: ApiErrorCode): ContentfulStatusCode {
    return STATUS_BY_CODE[code];
}

export function errorBody(c: AppContext, code: ApiErrorCode, message: string): ApiFailure {
    return { success: false, code, message, requestId: c.get('requestId') };
}

interface Failure {
    code: ApiErrorCode;
    status: ContentfulStatusCode;
    message: string;
}

// logs the error with the request id and decides the code, status and the message the client may see
function describeFailure(err: Error, c: AppContext): Failure {
    const log = requestLogger(c);

    if (err instanceof AppError) {
        const status = statusOf(err.code);
        const fields = { code: err.code, status, ...errorFields(err) };
        if (status >= 500) log.error('request failed', fields);
        else log.warn('request rejected', fields);
        return { code: err.code, status, message: err.message };
    }

    // hono's own errors, such as a malformed JSON body in a validator
    if (err instanceof HTTPException) {
        const code = CODE_BY_STATUS[err.status] ?? 'INTERNAL_ERROR';
        log.warn('request rejected', { code, status: err.status, ...errorFields(err) });
        return { code, status: err.status, message: err.message || 'The request could not be processed' };
    }

    log.error('unhandled error', { code: 'INTERNAL_ERROR', status: 500, ...errorFields(err) });
    return { code: 'INTERNAL_ERROR', status: 500, message: INTERNAL_MESSAGE };
}

// last in the pipeline: every error thrown by a controller, service, repository or middleware ends here
export function errorHandler(err: Error, c: AppContext): Response {
    const { code, status, message } = describeFailure(err, c);
    return c.json(errorBody(c, code, message), status);
}

// Supabase Auth hooks expect { error: { http_code, message } } and show the message to the person signing up
export function authHookErrorHandler(err: Error, c: AppContext): Response {
    const { status, message } = describeFailure(err, c);
    return c.json({ error: { http_code: status, message } } satisfies AuthHookFailure, status);
}

export function notFoundHandler(c: AppContext): Response {
    return c.json(errorBody(c, 'NOT_FOUND', `No API route matches ${c.req.method} ${c.req.path}`), 404);
}
