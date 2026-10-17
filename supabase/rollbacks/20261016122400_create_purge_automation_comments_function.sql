-- removes purge_automation_comments
drop function if exists public.purge_automation_comments(timestamptz, integer);
