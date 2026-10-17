-- removes automation_public_replies and every public reply; roll back the automation_attempts public reply change first
drop table if exists public.automation_public_replies;
