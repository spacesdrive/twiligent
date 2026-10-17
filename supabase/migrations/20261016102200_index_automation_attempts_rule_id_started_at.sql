-- adds an index that counts one rule's sends in the last hour
create index automation_attempts_rule_id_started_at_idx on public.automation_attempts (rule_id, started_at) where rule_id is not null;
