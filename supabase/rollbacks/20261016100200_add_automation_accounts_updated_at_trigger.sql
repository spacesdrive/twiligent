-- removes the trigger that keeps updated_at current on automation_accounts
drop trigger if exists automation_accounts_set_updated_at on public.automation_accounts;
