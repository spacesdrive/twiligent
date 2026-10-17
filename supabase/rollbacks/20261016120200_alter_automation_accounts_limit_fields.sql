-- removes the hourly limit marker and the webhook fields from automation_accounts
alter table public.automation_accounts
    drop column if exists subscribed_fields,
    drop column if exists limited_until;
