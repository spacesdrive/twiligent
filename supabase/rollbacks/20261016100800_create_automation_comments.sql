-- removes automation_comments and every received comment; roll back automation_attempts first
drop table if exists public.automation_comments;
