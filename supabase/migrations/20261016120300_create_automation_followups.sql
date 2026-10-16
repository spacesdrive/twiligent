-- a message sent after a person answered a followers-only private reply: the reply and link once Instagram says they
-- follow the account, a reminder to follow otherwise
create table public.automation_followups (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    automation_comment_id text not null references public.automation_comments (id) on delete cascade,
    ig_user_id text not null,
    recipient_id text not null,
    -- the person's message; Meta delivers a notification again until it is acknowledged
    trigger_message_id text not null,
    status text not null,
    status_reason text,
    error_message text,
    -- what was sent: set once the follow check answers
    kind text,
    attempts integer not null default 0,
    next_attempt_at timestamptz,
    claimed_at timestamptz,
    message_id text,
    accepted_at timestamptz,
    -- the person's message time plus 24 hours, Instagram's standard messaging window
    window_expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_followups_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint automation_followups_message_key unique (ig_user_id, trigger_message_id),
    constraint automation_followups_status_check check (status in (
        'queued', 'processing', 'retry_wait', 'sending', 'accepted', 'failed', 'needs_review', 'skipped', 'expired'
    )),
    constraint automation_followups_waiting_check check (status not in ('queued', 'retry_wait') or next_attempt_at is not null),
    constraint automation_followups_kind_check check (kind is null or kind in ('link', 'reminder')),
    constraint automation_followups_attempts_check check (attempts >= 0),
    constraint automation_followups_error_message_check check (error_message is null or char_length(error_message) <= 500)
);
