-- only allows known platforms and a JSON object as data on accounts
alter table public.accounts
    add constraint accounts_platform_check check (platform in ('youtube', 'instagram', 'reddit')),
    add constraint accounts_data_check check (jsonb_typeof(data) = 'object');
