-- removes every follow-up; roll back the automation_attempts change first
drop table if exists public.automation_followups;
