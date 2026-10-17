-- removes the public reply cooldown and limit from automation_accounts
alter table public.automation_accounts
    drop constraint if exists automation_accounts_public_cooldown_reason_check,
    drop column if exists public_limited_until,
    drop column if exists public_cooldown_reason,
    drop column if exists public_cooldown_until;
