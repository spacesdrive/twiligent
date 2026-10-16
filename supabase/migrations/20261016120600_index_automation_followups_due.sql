-- claim_automation_followups and the expiry: each account's follow-ups waiting to go out; partial, so the history is left out
create index automation_followups_due_idx on public.automation_followups (account_id, next_attempt_at) where status in ('queued', 'retry_wait');
