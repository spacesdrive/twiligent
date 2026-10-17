-- adds a separate cooldown and hourly limit for public replies to automation_accounts
alter table public.automation_accounts
    add column public_cooldown_until timestamptz,
    add column public_cooldown_reason text,
    add column public_limited_until timestamptz,
    add constraint automation_accounts_public_cooldown_reason_check check (public_cooldown_reason is null or char_length(public_cooldown_reason) <= 200);
