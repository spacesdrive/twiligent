-- removes the trigger that keeps updated_at current on mcp_client_grants
drop trigger if exists mcp_client_grants_set_updated_at on public.mcp_client_grants;
