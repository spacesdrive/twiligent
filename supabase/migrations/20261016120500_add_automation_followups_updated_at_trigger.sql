-- set_updated_at() keeps updated_at, so no query has to set it
create trigger automation_followups_set_updated_at before update on public.automation_followups
    for each row execute function public.set_updated_at();
