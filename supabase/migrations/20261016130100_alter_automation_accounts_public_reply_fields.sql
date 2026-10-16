-- public replies have their own cooldown and hourly limit: Instagram limits commenting and messaging apart, so a
-- block on one never holds the other
alter table public.automation_accounts
    add column public_cooldown_until timestamptz,
    add column public_cooldown_reason text,
    add column public_limited_until timestamptz,
    add constraint automation_accounts_public_cooldown_reason_check check (public_cooldown_reason is null or char_length(public_cooldown_reason) <= 200);
