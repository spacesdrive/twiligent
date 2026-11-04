-- removes Reddit accounts, with their stored cookies and passwords, and allows only YouTube and Instagram accounts
delete from public.accounts where platform = 'reddit';
alter table public.accounts
    drop constraint accounts_platform_check,
    add constraint accounts_platform_check check (platform in ('youtube', 'instagram'));
