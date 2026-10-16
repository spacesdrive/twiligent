-- the webhook reads only the enabled rules of an account
create index automation_rules_enabled_account_idx on public.automation_rules (account_id) where enabled;
