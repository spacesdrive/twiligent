-- adds an index that lists a user's comments newest first
create index automation_comments_user_id_created_at_idx on public.automation_comments (user_id, created_at desc);
