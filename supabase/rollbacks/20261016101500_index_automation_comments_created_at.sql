-- removes the index the daily clean-up of comments uses
drop index if exists public.automation_comments_created_at_idx;
