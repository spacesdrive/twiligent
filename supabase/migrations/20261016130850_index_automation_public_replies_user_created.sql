-- automation_stats: one user's public replies in a period
create index automation_public_replies_user_created_idx on public.automation_public_replies (user_id, created_at);
