alter table public.accounts
    drop constraint if exists accounts_data_check,
    drop constraint if exists accounts_platform_check;
