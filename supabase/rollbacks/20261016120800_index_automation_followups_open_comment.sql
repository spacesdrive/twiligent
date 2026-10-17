-- removes the one open follow-up per comment rule
drop index if exists public.automation_followups_open_comment_key;
