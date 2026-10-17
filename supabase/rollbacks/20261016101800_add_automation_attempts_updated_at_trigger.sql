-- removes the trigger that keeps updated_at current on automation_attempts
drop trigger if exists automation_attempts_set_updated_at on public.automation_attempts;
