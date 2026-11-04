-- turns row level security off on mcp_access_tokens; it had no browser grants to give back
alter table public.mcp_access_tokens disable row level security;
