-- removes the trigger that keeps updated_at current on mcp_access_tokens
drop trigger if exists mcp_access_tokens_set_updated_at on public.mcp_access_tokens;
