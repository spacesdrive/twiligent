-- adds the trigger that keeps updated_at current on mcp_client_grants
create trigger mcp_client_grants_set_updated_at before update on public.mcp_client_grants
    for each row execute function public.set_updated_at();
