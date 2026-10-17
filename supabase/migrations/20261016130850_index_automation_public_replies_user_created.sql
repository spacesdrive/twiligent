-- adds an index that counts a user's public replies for a period
create index automation_public_replies_user_created_idx on public.automation_public_replies (user_id, created_at);
