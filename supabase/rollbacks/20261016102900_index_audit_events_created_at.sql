-- removes the index the daily clean-up of audit events uses
drop index if exists public.audit_events_created_at_idx;
