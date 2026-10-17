-- removes the index that lists a user's accounts
drop index if exists public.accounts_user_id_created_at_idx;
