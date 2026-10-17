-- adds an index that finds the oldest audit events for the daily clean-up
create index audit_events_created_at_idx on public.audit_events (created_at);
