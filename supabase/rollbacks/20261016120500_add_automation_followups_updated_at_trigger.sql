-- removes the trigger that keeps updated_at current on automation_followups
drop trigger if exists automation_followups_set_updated_at on public.automation_followups;
