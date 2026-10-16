-- reserve_automation_send: replies to one person from one account in the last day
create index automation_attempts_recipient_idx on public.automation_attempts (account_id, recipient_id, started_at);
