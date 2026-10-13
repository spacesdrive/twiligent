// what Supabase Auth's Send Email hook sends, after validators/authHookValidators.ts has read it
export interface AuthEmailHook {
    email: string;
    // set on email_change: the address the user is moving to
    newEmail: string | undefined;
    // signup, recovery, magiclink, invite, email_change, email, reauthentication or a *_notification
    action: string;
    // the 6-digit code; empty for notifications
    token: string;
    tokenHash: string;
    // on email_change with Secure Email Change on, the second code and hash
    tokenNew: string;
    tokenHashNew: string;
    redirectTo: string;
    siteUrl: string;
}

// the error body Supabase Auth reads from a hook; it passes the message to the client
export interface AuthHookFailure {
    error: {
        http_code: number;
        message: string;
    };
}
