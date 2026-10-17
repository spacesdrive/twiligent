-- removes the index of replies waiting to be sent
drop index if exists public.automation_comments_due_idx;
