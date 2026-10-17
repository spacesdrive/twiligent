-- removes the index that lists a user's audit events
drop index if exists public.audit_events_user_id_created_at_idx;
