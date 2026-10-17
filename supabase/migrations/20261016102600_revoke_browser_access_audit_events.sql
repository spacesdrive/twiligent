-- turns on row level security and removes browser access to audit_events
alter table public.audit_events enable row level security;
revoke all on table public.audit_events from anon, authenticated;
