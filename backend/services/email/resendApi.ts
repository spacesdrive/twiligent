import { UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import type { EmailMessage } from './authEmails.ts';

const SEND_URL = 'https://api.resend.com/emails';

// Supabase gives the whole hook call 5 seconds, so a slow send is abandoned before Supabase gives up on the Worker
const SEND_TIMEOUT_MS = 4000;

// Resend's error body; name is the machine-readable reason, such as daily_quota_exceeded
interface ResendErrorBody {
    name?: string;
    message?: string;
}

export interface ResendSend {
    apiKey: string;
    from: string;
    message: EmailMessage;
    // the same key on a retried hook call makes Resend skip the duplicate
    idempotencyKey: string;
}

export async function sendEmail({ apiKey, from, message, idempotencyKey }: ResendSend, signal?: AbortSignal): Promise<void> {
    const timeout = AbortSignal.timeout(SEND_TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(SEND_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Resend', err);
        throw new UpstreamError(`Resend unreachable (${(err as Error).message})`, { cause: err });
    }
    if (response.ok) return;

    const body = await response.json().catch(() => null) as ResendErrorBody | null;
    throw new UpstreamError(`Resend could not send the email: ${body?.message || `status ${response.status}`}`, {
        reason: body?.name ?? '',
        status: response.status,
    });
}
