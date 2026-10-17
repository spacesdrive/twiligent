-- allows each account only once per user, so two adds at the same moment store one row
create unique index if not exists accounts_identity_key on public.accounts (
    user_id,
    platform,
    (case platform when 'youtube' then data ->> 'channelId' when 'reddit' then data ->> 'username' when 'instagram' then data ->> 'igUserId' end)
);
