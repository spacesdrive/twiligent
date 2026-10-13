import { NotConfiguredError, RateLimitedError, UpstreamError } from '../lib/errors.ts';
import { composeAuthEmails } from './email/authEmails.ts';
import { sendEmail } from './email/resendApi.ts';
import type { AuthEmail } from './email/authEmails.ts';
import type { EmailQuotaRepository } from '../repositories/emailQuotaRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { AuthEmailHook } from '../types/authHook.ts';
import type { RequestContext } from '../types/context.ts';

// enough for a few resends and a password reset, while one address cannot use up the day's allowance
export const RECIPIENT_DAILY_LIMIT = 5;

// shown on the sign-up form, which also points to the Google button
export const DAILY_LIMIT_MESSAGE = 'Twiligent has sent all the verification emails it can today. Sign in with Google instead, or try again tomorrow.';
export const RECIPIENT_LIMIT_MESSAGE = 'This address has received the most codes allowed today. Use the latest code you received, or try again tomorrow.';

// Resend's answers when the account itself has run out
const PROVIDER_QUOTA_REASONS = ['daily_quota_exceeded', 'monthly_quota_exceeded'];

export interface AuthEmailDeps {
    quota: EmailQuotaRepository;
    config: AppConfig;
    context: RequestContext;
    now?: () => Date;
}

export interface AuthEmailService {
    send(hook: AuthEmailHook, webhookId: string): Promise<void>;
}

export function createAuthEmailService({ quota, config, context, now = () => new Date() }: AuthEmailDeps): AuthEmailService {
    const { resendApiKey, from, dailyLimit, supabaseUrl } = config.authEmail;

    // the counters follow the UTC day, as Resend's daily quota does
    const today = () => now().toISOString().slice(0, 10);

    async function claim(email: AuthEmail): Promise<void> {
        const outcome = await quota.claim({ recipient: email.to, day: today(), dailyLimit, recipientLimit: RECIPIENT_DAILY_LIMIT });
        if (outcome === 'daily_limit') throw new RateLimitedError(DAILY_LIMIT_MESSAGE);
        if (outcome === 'recipient_limit') throw new RateLimitedError(RECIPIENT_LIMIT_MESSAGE);
        if (outcome === 'unknown') context.log.warn('email counter unavailable', { reason: 'redis' });
    }

    async function deliver(email: AuthEmail, apiKey: string, sender: string, idempotencyKey: string): Promise<void> {
        try {
            await sendEmail({ apiKey, from: sender, message: email, idempotencyKey }, context.signal);
        } catch (err) {
            if (err instanceof UpstreamError && PROVIDER_QUOTA_REASONS.includes(err.reason)) throw new RateLimitedError(DAILY_LIMIT_MESSAGE);
            throw err;
        }
    }

    return {
        async send(hook, webhookId) {
            if (!resendApiKey || !from) {
                throw new NotConfiguredError('Email sending is not set up: the RESEND_API_KEY and EMAIL_FROM Worker secrets are required');
            }

            const emails = composeAuthEmails(hook, supabaseUrl);
            if (emails.length === 0) {
                context.log.warn('auth email skipped', { action: hook.action, reason: 'unknown action' });
                return;
            }

            for (const [index, email] of emails.entries()) {
                try {
                    await claim(email);
                    await deliver(email, resendApiKey, from, `${webhookId}-${index}`);
                } catch (err) {
                    // a notice reports a change already made, so losing it must not fail the user's action
                    if (email.notice && err instanceof RateLimitedError) {
                        context.log.warn('auth email skipped', { action: hook.action, reason: 'limit reached' });
                        continue;
                    }
                    throw err;
                }
            }
            context.log.info('auth email sent', { action: hook.action, count: emails.length });
        },
    };
}
