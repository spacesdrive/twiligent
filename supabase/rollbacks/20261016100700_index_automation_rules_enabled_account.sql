-- removes the index of enabled rules by account
drop index if exists public.automation_rules_enabled_account_idx;
