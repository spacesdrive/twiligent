-- reserve_automation_send: sends in the last hour across the instance
create index automation_attempts_started_at_idx on public.automation_attempts (started_at);
