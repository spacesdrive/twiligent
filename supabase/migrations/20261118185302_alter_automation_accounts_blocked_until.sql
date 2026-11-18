-- adds when Instagram's latest block of an account's private replies ends, so sending can restart slowly after it
alter table public.automation_accounts
    add column blocked_until timestamptz;
