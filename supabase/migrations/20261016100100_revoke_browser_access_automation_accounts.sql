-- turns on row level security and removes browser access to automation_accounts
alter table public.automation_accounts enable row level security;
revoke all on table public.automation_accounts from anon, authenticated;
