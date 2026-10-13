import type { ApiFailure } from '../../../shared/types/domain.ts';

// a server-side failure is logged under its request id, so the message carries the id for the user to quote
export function failureMessage(status: number, body: Partial<ApiFailure> | null): string {
    const message = body?.message || `The server answered with status ${status}. Try again in a moment.`;
    return status >= 500 && body?.requestId ? `${message} (request ${body.requestId})` : message;
}
