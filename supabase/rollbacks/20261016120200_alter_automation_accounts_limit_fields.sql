alter table public.automation_accounts
    drop column if exists subscribed_fields,
    drop column if exists limited_until;
