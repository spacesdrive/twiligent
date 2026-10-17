-- removes the index that counts one user's sends
drop index if exists public.automation_attempts_user_id_started_at_idx;
