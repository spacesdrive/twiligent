-- makes the pair of account id and owner unique, so other tables can point at an account together with its owner
alter table public.accounts add constraint accounts_id_user_id_key unique (id, user_id);
