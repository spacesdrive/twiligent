-- turns row level security off on automation_accounts; it had no browser grants to give back
alter table public.automation_accounts disable row level security;
