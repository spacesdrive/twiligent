-- adds an index that counts the instance's sends in the last hour
create index automation_attempts_started_at_idx on public.automation_attempts (started_at);
