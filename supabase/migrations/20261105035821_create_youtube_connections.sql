-- creates youtube_connections, one Google sign-in per channel a person connected for publishing, with its tokens sealed
create table public.youtube_connections (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    -- the analytics account for the same channel, when the person has one
    account_id text,
    channel_id text not null,
    channel_title text not null default '',
    scopes text[] not null default '{}',
    status text not null default 'active',
    -- AES-GCM sealed with a key derived from TOKEN_ENCRYPTION_KEY; never sent to a browser, a log or Claude
    refresh_token_enc text not null,
    access_token_enc text,
    access_token_expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint youtube_connections_user_channel_key unique (user_id, channel_id),
    constraint youtube_connections_status_check check (status in ('active', 'needs_reconnect')),
    constraint youtube_connections_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete set null (account_id)
);
