-- removes the unique account id and owner pair; roll back the two account foreign keys first
alter table public.accounts drop constraint if exists accounts_id_user_id_key;
