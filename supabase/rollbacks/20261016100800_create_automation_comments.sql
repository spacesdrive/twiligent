-- removes every received comment and its reply history; roll back automation_attempts first
drop table if exists public.automation_comments;
