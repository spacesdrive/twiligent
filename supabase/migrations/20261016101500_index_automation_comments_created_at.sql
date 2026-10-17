-- adds an index that finds the oldest comments for the daily clean-up
create index automation_comments_created_at_idx on public.automation_comments (created_at);
