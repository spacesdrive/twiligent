-- removes every public reply; roll back the automation_attempts change first
drop table if exists public.automation_public_replies;
