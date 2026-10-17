-- removes the index of follow-ups by comment
drop index if exists public.automation_followups_comment_id_idx;
