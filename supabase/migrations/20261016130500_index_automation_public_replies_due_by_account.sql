-- claim_automation_public_replies and the expiry: each account's public replies waiting to go out, so accounts take
-- turns however long one queue is; partial, so the history is left out
create index automation_public_replies_due_account_idx on public.automation_public_replies (account_id, next_attempt_at) where status in ('queued', 'retry_wait');
