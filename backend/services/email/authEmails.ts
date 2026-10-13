import type { AuthEmailHook } from '../../types/authHook.ts';

export interface EmailMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
}

// a notice only reports a change already made, so it may be skipped when the daily cap is reached
export interface AuthEmail extends EmailMessage {
    notice: boolean;
}

interface CodeEmailCopy {
    subject: string;
    lead: string;
    // the label of the link that does the same as the code; omitted when there is no link
    linkLabel?: string;
}

const CODE_EMAILS: Record<string, CodeEmailCopy> = {
    signup: {
        subject: 'Your Twiligent verification code',
        lead: 'Enter this code on the sign-up page to confirm your email and finish creating your account.',
        linkLabel: 'Or confirm your email with this link',
    },
    recovery: {
        subject: 'Reset your Twiligent password',
        lead: 'Enter this code to choose a new password.',
        linkLabel: 'Or reset your password with this link',
    },
    magiclink: {
        subject: 'Your Twiligent sign-in code',
        lead: 'Enter this code to sign in.',
        linkLabel: 'Or sign in with this link',
    },
    email: {
        subject: 'Your Twiligent sign-in code',
        lead: 'Enter this code to sign in.',
        linkLabel: 'Or sign in with this link',
    },
    invite: {
        subject: 'You have been invited to Twiligent',
        lead: 'You have been invited to create a Twiligent account. Enter this code to accept the invitation.',
        linkLabel: 'Or accept the invitation with this link',
    },
    reauthentication: {
        subject: 'Your Twiligent confirmation code',
        lead: 'Enter this code to confirm it is you.',
    },
};

const NOTICES: Record<string, string> = {
    password_changed_notification: 'The password for your Twiligent account was changed.',
    email_changed_notification: 'The email address for your Twiligent account was changed.',
    phone_changed_notification: 'The phone number for your Twiligent account was changed.',
    identity_linked_notification: 'A new sign-in method was added to your Twiligent account.',
    identity_unlinked_notification: 'A sign-in method was removed from your Twiligent account.',
    mfa_factor_enrolled_notification: 'Two-step verification was turned on for your Twiligent account.',
    mfa_factor_unenrolled_notification: 'A two-step verification method was removed from your Twiligent account.',
};

const IGNORE_NOTE = 'If you did not ask for this, you can ignore this email.';
const NOTICE_NOTE = 'If this was not you, reset your password and review the sign-in methods on your account.';

function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// the same endpoint Supabase's default templates link to; it verifies the hash and redirects to the app
function verifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string): string {
    const params = new URLSearchParams({ token: tokenHash, type });
    if (redirectTo) params.set('redirect_to', redirectTo);
    return `${supabaseUrl}/auth/v1/verify?${params}`;
}

function paragraph(text: string): string {
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#3f3f46">${escapeHtml(text)}</p>`;
}

function layout(blocks: string[]): string {
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif">`
        + `<div style="max-width:480px;margin:0 auto">${blocks.join('')}</div></body></html>`;
}

interface CodeEmailParts {
    to: string;
    copy: CodeEmailCopy;
    code: string;
    link: string | undefined;
}

function codeEmail({ to, copy, code, link }: CodeEmailParts): AuthEmail {
    const text = [copy.lead, '', code, '', 'The code works once and expires soon.'];
    const html = [
        paragraph(copy.lead),
        `<p style="margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:6px;font-family:'Courier New',monospace;color:#18181b">${escapeHtml(code)}</p>`,
        paragraph('The code works once and expires soon.'),
    ];
    if (link && copy.linkLabel) {
        text.push('', `${copy.linkLabel}: ${link}`);
        html.push(`<p style="margin:0 0 16px;font-size:15px"><a href="${escapeHtml(link)}" style="color:#4f46e5">${escapeHtml(copy.linkLabel)}</a></p>`);
    }
    text.push('', IGNORE_NOTE);
    html.push(paragraph(IGNORE_NOTE));
    return { to, subject: copy.subject, text: text.join('\n'), html: layout(html), notice: false };
}

function noticeEmail(to: string, message: string): AuthEmail {
    return {
        to,
        subject: 'A change to your Twiligent account',
        text: [message, '', NOTICE_NOTE].join('\n'),
        html: layout([paragraph(message), paragraph(NOTICE_NOTE)]),
        notice: true,
    };
}

// Secure Email Change sends a code to both addresses; Supabase names the hashes the other way round
function emailChangeEmails(hook: AuthEmailHook, supabaseUrl: string): AuthEmail[] {
    const link = (hash: string) => (hash ? verifyUrl(supabaseUrl, hash, 'email_change', hook.redirectTo) : undefined);
    const toNew = (code: string, hash: string): AuthEmail => codeEmail({
        to: hook.newEmail ?? hook.email,
        copy: {
            subject: 'Confirm your new Twiligent email address',
            lead: 'Enter this code to confirm this address as the new email for your Twiligent account.',
            linkLabel: 'Or confirm the new address with this link',
        },
        code,
        link: link(hash),
    });

    if (hook.token && hook.tokenNew && hook.newEmail) {
        return [
            codeEmail({
                to: hook.email,
                copy: {
                    subject: 'Confirm the change to your Twiligent email address',
                    lead: `Enter this code to confirm moving your Twiligent account to ${hook.newEmail}.`,
                    linkLabel: 'Or confirm the change with this link',
                },
                code: hook.token,
                link: link(hook.tokenHashNew),
            }),
            toNew(hook.tokenNew, hook.tokenHash),
        ];
    }
    return [toNew(hook.token || hook.tokenNew, hook.tokenHash || hook.tokenHashNew)];
}

// the emails one hook call asks for; an action this Worker does not know yields none
export function composeAuthEmails(hook: AuthEmailHook, supabaseUrl: string): AuthEmail[] {
    if (hook.action === 'email_change') return emailChangeEmails(hook, supabaseUrl);

    const notice = NOTICES[hook.action];
    if (notice) return [noticeEmail(hook.email, notice)];

    const copy = CODE_EMAILS[hook.action];
    if (!copy || !hook.token) return [];
    const link = hook.tokenHash ? verifyUrl(supabaseUrl, hook.tokenHash, hook.action, hook.redirectTo) : undefined;
    return [codeEmail({ to: hook.email, copy, code: hook.token, link })];
}
