-- removes the index that lists a user's rules
drop index if exists public.automation_rules_user_id_created_at_idx;
