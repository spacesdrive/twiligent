-- only the Worker's service role reads audit_events; the anon key ships in every browser
alter table public.audit_events enable row level security;
revoke all on table public.audit_events from anon, authenticated;
