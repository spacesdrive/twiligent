-- id alone is unique, so (id, user_id) is too; naming the pair lets a post reference an account with its owner
alter table public.accounts add constraint accounts_id_user_id_key unique (id, user_id);
