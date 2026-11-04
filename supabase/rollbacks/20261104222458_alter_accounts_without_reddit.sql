-- allows Reddit accounts again; the deleted rows come back only from the backup taken before the change
alter table public.accounts
    drop constraint accounts_platform_check,
    add constraint accounts_platform_check check (platform in ('youtube', 'instagram', 'reddit'));
