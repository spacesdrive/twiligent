-- turns on row level security and removes browser access to mcp_access_tokens
alter table public.mcp_access_tokens enable row level security;
revoke all on table public.mcp_access_tokens from anon, authenticated;
