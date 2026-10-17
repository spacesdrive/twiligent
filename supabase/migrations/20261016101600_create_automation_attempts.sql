-- creates automation_attempts, which records every request sent to Instagram so the sending limits can count them
create table public.automation_attempts (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    automation_comment_id text not null references public.automation_comments (id) on delete cascade,
    rule_id text references public.automation_rules (id) on delete set null,
    recipient_id text,
    outcome text not null default 'sending',
    error_code integer,
    error_subcode integer,
    http_status integer,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_attempts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint automation_attempts_outcome_check check (outcome in ('sending', 'accepted', 'rejected', 'rate_limited', 'ambiguous'))
);
