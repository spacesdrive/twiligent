-- adds the trigger that keeps updated_at current on automation_attempts
create trigger automation_attempts_set_updated_at before update on public.automation_attempts
    for each row execute function public.set_updated_at();
