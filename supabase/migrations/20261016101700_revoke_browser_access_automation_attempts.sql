-- only the Worker's service role reads automation_attempts; the anon key ships in every browser
alter table public.automation_attempts enable row level security;
revoke all on table public.automation_attempts from anon, authenticated;
