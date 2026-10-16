-- only the Worker's service role reads automation_accounts; the anon key ships in every browser
alter table public.automation_accounts enable row level security;
revoke all on table public.automation_accounts from anon, authenticated;
