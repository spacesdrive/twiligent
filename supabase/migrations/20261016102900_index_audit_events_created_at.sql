-- the daily retention delete across all users
create index audit_events_created_at_idx on public.audit_events (created_at);
