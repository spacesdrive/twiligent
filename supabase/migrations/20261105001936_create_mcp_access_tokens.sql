-- creates mcp_access_tokens, which holds the hashes of the personal access tokens Claude clients sign in with
create table public.mcp_access_tokens (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    label text not null,
    -- SHA-256 of the token; the token itself is shown once and never stored
    token_hash text not null,
    -- the last four characters, so a person can tell their tokens apart
    token_hint text not null,
    permission text not null,
    last_used_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint mcp_access_tokens_token_hash_key unique (token_hash),
    constraint mcp_access_tokens_permission_check check (permission in ('read', 'write')),
    constraint mcp_access_tokens_label_check check (char_length(label) between 1 and 80),
    constraint mcp_access_tokens_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
    constraint mcp_access_tokens_token_hint_check check (char_length(token_hint) = 4)
);
