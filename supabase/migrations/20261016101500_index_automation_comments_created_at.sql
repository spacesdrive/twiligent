-- the daily retention delete across all users
create index automation_comments_created_at_idx on public.automation_comments (created_at);
