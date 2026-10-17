-- adds an index that finds an account's enabled rules when a comment arrives
create index automation_rules_enabled_account_idx on public.automation_rules (account_id) where enabled;
