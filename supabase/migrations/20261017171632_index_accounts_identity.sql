-- one row per user, platform and account, so two adds at the same moment cannot store the same account twice; the
-- identity is the field each platform's account is matched by in accountService
create unique index if not exists accounts_identity_key on public.accounts (
    user_id,
    platform,
    (case platform when 'youtube' then data ->> 'channelId' when 'reddit' then data ->> 'username' when 'instagram' then data ->> 'igUserId' end)
);
