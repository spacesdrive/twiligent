-- removes the index that counts a user's public replies
drop index if exists public.automation_public_replies_user_created_idx;
