-- creates mcp_client_grants, which records what each Claude client a person approved may do for them
create table public.mcp_client_grants (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    -- the OAuth client id Supabase Auth issued to the Claude client
    client_id text not null,
    client_name text not null,
    permission text not null,
    last_used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint mcp_client_grants_user_client_key unique (user_id, client_id),
    constraint mcp_client_grants_permission_check check (permission in ('read', 'write')),
    constraint mcp_client_grants_client_name_check check (char_length(client_name) between 1 and 200)
);
