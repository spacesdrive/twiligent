-- turns row level security off on mcp_client_grants; it had no browser grants to give back
alter table public.mcp_client_grants disable row level security;
