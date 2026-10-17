-- adds an index that finds replies waiting to be sent, without reading old comments
create index automation_comments_due_idx on public.automation_comments (next_attempt_at) where status in ('queued', 'retry_wait');
