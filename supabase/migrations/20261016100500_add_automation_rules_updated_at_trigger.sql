-- adds the trigger that keeps updated_at current on automation_rules
create trigger automation_rules_set_updated_at before update on public.automation_rules
    for each row execute function public.set_updated_at();
