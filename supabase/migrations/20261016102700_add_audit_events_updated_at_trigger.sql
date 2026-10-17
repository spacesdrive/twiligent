-- adds the trigger that keeps updated_at current on audit_events
create trigger audit_events_set_updated_at before update on public.audit_events
    for each row execute function public.set_updated_at();
