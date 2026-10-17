-- removes automation_rules and every rule in it; roll back automation_comments and automation_attempts first
drop table if exists public.automation_rules;
