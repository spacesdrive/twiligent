-- removes automation_followups and every follow-up; roll back the automation_attempts kind change first
drop table if exists public.automation_followups;
