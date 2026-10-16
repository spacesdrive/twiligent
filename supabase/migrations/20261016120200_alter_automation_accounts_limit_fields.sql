alter table public.automation_accounts
    -- set when the account reached its hourly reply limit, so runs leave its jobs alone until a send frees up
    add column limited_until timestamptz,
    -- the webhook fields Instagram confirmed for the account; follow checks need messages as well as comments
    add column subscribed_fields text[];
