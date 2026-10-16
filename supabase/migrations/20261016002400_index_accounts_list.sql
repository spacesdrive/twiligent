-- accounts.listForUser: where user_id = $1 order by created_at, id
create index if not exists accounts_user_id_created_at_idx on public.accounts (user_id, created_at, id);
