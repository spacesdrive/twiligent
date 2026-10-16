drop trigger if exists accounts_set_updated_at on public.accounts;
alter table public.accounts drop column if exists updated_at;
