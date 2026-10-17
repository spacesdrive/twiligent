-- turns on row level security and removes browser access to automation_followups
alter table public.automation_followups enable row level security;
revoke all on table public.automation_followups from anon, authenticated;
