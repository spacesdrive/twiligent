-- adds an index that finds each account's oldest due replies, so accounts can take turns
create index automation_comments_due_account_idx on public.automation_comments (account_id, next_attempt_at) where status in ('queued', 'retry_wait');
