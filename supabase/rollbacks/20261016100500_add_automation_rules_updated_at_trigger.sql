-- removes the trigger that keeps updated_at current on automation_rules
drop trigger if exists automation_rules_set_updated_at on public.automation_rules;
