-- turns on row level security and removes browser access to automation_comments
alter table public.automation_comments enable row level security;
revoke all on table public.automation_comments from anon, authenticated;
