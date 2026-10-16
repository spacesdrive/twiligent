-- only the Worker's service role reads automation_rules; the anon key ships in every browser
alter table public.automation_rules enable row level security;
revoke all on table public.automation_rules from anon, authenticated;
