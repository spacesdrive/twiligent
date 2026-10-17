-- adds an index that lists a user's accounts in the order they were added
create index if not exists accounts_user_id_created_at_idx on public.accounts (user_id, created_at, id);
