-- claim_automation_comments: each account's oldest due jobs, so accounts take turns however long one queue is
create index automation_comments_due_account_idx on public.automation_comments (account_id, next_attempt_at) where status in ('queued', 'retry_wait');
