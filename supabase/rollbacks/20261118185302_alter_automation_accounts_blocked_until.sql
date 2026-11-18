-- removes the end of the latest private reply block from automation_accounts
alter table public.automation_accounts
    drop column if exists blocked_until;
