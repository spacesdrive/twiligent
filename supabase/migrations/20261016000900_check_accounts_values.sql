-- an unknown platform or a data value that is not an object fails at the write instead of breaking a later read
alter table public.accounts
    add constraint accounts_platform_check check (platform in ('youtube', 'instagram', 'reddit')),
    add constraint accounts_data_check check (jsonb_typeof(data) = 'object');
