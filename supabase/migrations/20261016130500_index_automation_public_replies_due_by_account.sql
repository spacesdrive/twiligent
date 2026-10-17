-- adds an index that finds each account's public replies waiting to be posted
create index automation_public_replies_due_account_idx on public.automation_public_replies (account_id, next_attempt_at) where status in ('queued', 'retry_wait');
