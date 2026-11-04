-- rebuilds the one-account-per-user index with the Reddit username branch it had before
drop index if exists public.accounts_identity_key;
create unique index accounts_identity_key on public.accounts (
    user_id,
    platform,
    (case platform when 'youtube' then data ->> 'channelId' when 'reddit' then data ->> 'username' when 'instagram' then data ->> 'igUserId' end)
);
