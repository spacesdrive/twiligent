-- creates automation_accounts, which holds each Instagram account's pause, cooldowns and webhook subscription
create table public.automation_accounts (
    account_id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    paused boolean not null default false,
    -- null when the owner paused it; set when the Worker held replies because Instagram refused the account's token
    paused_reason text,
    cooldown_until timestamptz,
    cooldown_reason text,
    subscribed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_accounts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint automation_accounts_paused_reason_check check (paused_reason is null or char_length(paused_reason) <= 200),
    constraint automation_accounts_cooldown_reason_check check (cooldown_reason is null or char_length(cooldown_reason) <= 200)
);
