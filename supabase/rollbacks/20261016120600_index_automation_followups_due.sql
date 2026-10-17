-- removes the index of follow-ups waiting to be sent
drop index if exists public.automation_followups_due_idx;
