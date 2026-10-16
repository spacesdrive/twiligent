-- removes every automation rule; roll back automation_comments and automation_attempts first
drop table if exists public.automation_rules;
