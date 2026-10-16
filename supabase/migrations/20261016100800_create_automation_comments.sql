-- every comment the webhook delivered for an account with an enabled rule; a matched comment is also the job that sends its reply
create table public.automation_comments (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    rule_id text references public.automation_rules (id) on delete set null,
    -- the professional account the webhook named, so a comment is stored once however many members connected that account
    ig_user_id text not null,
    comment_id text not null,
    media_id text,
    from_id text,
    from_username text,
    -- kept only for matched comments; others are counted without their words
    text text,
    status text not null,
    status_reason text,
    error_message text,
    attempts integer not null default 0,
    next_attempt_at timestamptz,
    claimed_at timestamptz,
    message_id text,
    accepted_at timestamptz,
    -- when Meta sent the notification; private replies close 7 days after the comment
    notified_at timestamptz not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_comments_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    -- Meta delivers a notification again until it is acknowledged, so the second copy is refused here
    constraint automation_comments_comment_key unique (ig_user_id, comment_id),
    constraint automation_comments_status_check check (status in (
        'ignored', 'queued', 'processing', 'retry_wait', 'sending', 'accepted', 'failed', 'needs_review', 'skipped', 'expired'
    )),
    constraint automation_comments_waiting_check check (status not in ('queued', 'retry_wait') or next_attempt_at is not null),
    constraint automation_comments_attempts_check check (attempts >= 0),
    -- Instagram comments are at most 2,200 characters
    constraint automation_comments_text_check check (text is null or char_length(text) <= 2200),
    constraint automation_comments_error_message_check check (error_message is null or char_length(error_message) <= 500)
);
