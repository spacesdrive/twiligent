-- set_updated_at() keeps updated_at, so no query has to set it
create trigger audit_events_set_updated_at before update on public.audit_events
    for each row execute function public.set_updated_at();
