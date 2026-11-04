-- turns on row level security and removes browser access to mcp_client_grants
alter table public.mcp_client_grants enable row level security;
revoke all on table public.mcp_client_grants from anon, authenticated;
