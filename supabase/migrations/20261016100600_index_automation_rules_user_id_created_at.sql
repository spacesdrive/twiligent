-- adds an index that lists a user's rules in the order they were made
create index automation_rules_user_id_created_at_idx on public.automation_rules (user_id, created_at, id);
