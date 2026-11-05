-- adds the trigger that keeps updated_at current on mcp_access_tokens
create trigger mcp_access_tokens_set_updated_at before update on public.mcp_access_tokens
    for each row execute function public.set_updated_at();
