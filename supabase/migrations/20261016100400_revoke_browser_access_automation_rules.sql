-- turns on row level security and removes browser access to automation_rules
alter table public.automation_rules enable row level security;
revoke all on table public.automation_rules from anon, authenticated;
