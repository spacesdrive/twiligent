-- only the Worker's service role reads automation_comments; the anon key ships in every browser
alter table public.automation_comments enable row level security;
revoke all on table public.automation_comments from anon, authenticated;
