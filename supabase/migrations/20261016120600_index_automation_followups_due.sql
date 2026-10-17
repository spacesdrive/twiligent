-- adds an index that finds each account's follow-ups waiting to be sent
create index automation_followups_due_idx on public.automation_followups (account_id, next_attempt_at) where status in ('queued', 'retry_wait');
