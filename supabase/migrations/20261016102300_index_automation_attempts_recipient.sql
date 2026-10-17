-- adds an index that counts the replies one person got from one account in the last day
create index automation_attempts_recipient_idx on public.automation_attempts (account_id, recipient_id, started_at);
