-- adds the trigger that keeps updated_at current on automation_followups
create trigger automation_followups_set_updated_at before update on public.automation_followups
    for each row execute function public.set_updated_at();
