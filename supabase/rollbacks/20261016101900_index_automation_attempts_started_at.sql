-- removes the index that counts the instance's sends
drop index if exists public.automation_attempts_started_at_idx;
