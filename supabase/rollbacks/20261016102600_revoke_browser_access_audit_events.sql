-- turns row level security off on audit_events; it had no browser grants to give back
alter table public.audit_events disable row level security;
