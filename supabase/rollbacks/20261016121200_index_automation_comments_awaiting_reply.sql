-- removes the index of replies waiting for an answer
drop index if exists public.automation_comments_awaiting_reply_idx;
