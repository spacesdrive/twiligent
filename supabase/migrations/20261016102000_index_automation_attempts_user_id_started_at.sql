-- adds an index that counts one user's sends in the last hour
create index automation_attempts_user_id_started_at_idx on public.automation_attempts (user_id, started_at);
