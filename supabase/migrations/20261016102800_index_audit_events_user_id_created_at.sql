-- auditEvents.listForUser: where user_id = $1 order by created_at desc
create index audit_events_user_id_created_at_idx on public.audit_events (user_id, created_at desc);
