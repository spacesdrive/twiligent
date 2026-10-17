-- adds an index that counts one Instagram account's sends in the last hour
create index automation_attempts_account_id_started_at_idx on public.automation_attempts (account_id, started_at);
