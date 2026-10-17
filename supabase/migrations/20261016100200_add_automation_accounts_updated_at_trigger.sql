-- adds the trigger that keeps updated_at current on automation_accounts
create trigger automation_accounts_set_updated_at before update on public.automation_accounts
    for each row execute function public.set_updated_at();
