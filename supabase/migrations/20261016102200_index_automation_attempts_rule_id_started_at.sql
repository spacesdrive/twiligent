-- reserve_automation_send: sends in the last hour for one rule
create index automation_attempts_rule_id_started_at_idx on public.automation_attempts (rule_id, started_at) where rule_id is not null;
