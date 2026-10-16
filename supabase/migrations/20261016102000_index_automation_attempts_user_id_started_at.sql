-- reserve_automation_send: sends in the last hour for one member
create index automation_attempts_user_id_started_at_idx on public.automation_attempts (user_id, started_at);
