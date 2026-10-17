-- removes the index that counts one rule's sends
drop index if exists public.automation_attempts_rule_id_started_at_idx;
