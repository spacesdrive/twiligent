-- removes the index that lists a user's comments
drop index if exists public.automation_comments_user_id_created_at_idx;
