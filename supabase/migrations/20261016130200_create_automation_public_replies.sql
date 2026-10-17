-- creates automation_public_replies, which holds the public reply under each matched comment as its own job
create table public.automation_public_replies (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    automation_comment_id text not null references public.automation_comments (id) on delete cascade,
    rule_id text references public.automation_rules (id) on delete set null,
    ig_user_id text not null,
    -- the comment answered, with its post and author for the limit of one public reply per person and post a day
    comment_id text not null,
    media_id text,
    from_id text,
    -- picked from the rule's texts when the comment arrived, so every try and every check sees the same words
    reply_text text not null,
    status text not null,
    status_reason text,
    error_message text,
    attempts integer not null default 0,
    next_attempt_at timestamptz,
    claimed_at timestamptz,
    -- the id Instagram gave the reply
    reply_id text,
    accepted_at timestamptz,
    -- checks of a reply whose outcome was unknown against the comment's replies on Instagram
    review_checks integer not null default 0,
    review_checked_at timestamptz,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_public_replies_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint automation_public_replies_comment_key unique (automation_comment_id),
    constraint automation_public_replies_status_check check (status in (
        'queued', 'processing', 'retry_wait', 'sending', 'accepted', 'failed', 'needs_review', 'skipped', 'expired'
    )),
    constraint automation_public_replies_waiting_check check (status not in ('queued', 'retry_wait') or next_attempt_at is not null),
    constraint automation_public_replies_attempts_check check (attempts >= 0),
    constraint automation_public_replies_review_checks_check check (review_checks >= 0),
    -- Instagram comments are at most 2,200 characters
    constraint automation_public_replies_reply_text_check check (char_length(reply_text) between 1 and 2200),
    constraint automation_public_replies_error_message_check check (error_message is null or char_length(error_message) <= 500)
);
