-- only the Worker's service role reads automation_public_replies; the anon key ships in every browser
alter table public.automation_public_replies enable row level security;
revoke all on table public.automation_public_replies from anon, authenticated;
