-- only the Worker's service role reads automation_followups; the anon key ships in every browser
alter table public.automation_followups enable row level security;
revoke all on table public.automation_followups from anon, authenticated;
