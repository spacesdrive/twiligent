-- turns on row level security and removes browser access to automation_attempts
alter table public.automation_attempts enable row level security;
revoke all on table public.automation_attempts from anon, authenticated;
