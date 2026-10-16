-- reserve_automation_send: sends in the last hour for one Instagram account
create index automation_attempts_account_id_started_at_idx on public.automation_attempts (account_id, started_at);
