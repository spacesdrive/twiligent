-- turns on row level security and removes browser access to automation_public_replies
alter table public.automation_public_replies enable row level security;
revoke all on table public.automation_public_replies from anon, authenticated;
