-- adds an index that lists a user's audit events newest first
create index audit_events_user_id_created_at_idx on public.audit_events (user_id, created_at desc);
