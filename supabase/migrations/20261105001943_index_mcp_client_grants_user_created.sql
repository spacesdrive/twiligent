-- adds an index that lists the Claude clients a person approved, newest first
create index mcp_client_grants_user_created_idx on public.mcp_client_grants (user_id, created_at desc);
