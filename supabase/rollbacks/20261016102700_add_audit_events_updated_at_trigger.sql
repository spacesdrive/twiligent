-- removes the trigger that keeps updated_at current on audit_events
drop trigger if exists audit_events_set_updated_at on public.audit_events;
