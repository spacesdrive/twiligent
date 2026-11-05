-- removes mcp_access_tokens, which signs out every Claude client that used a personal access token
drop table if exists public.mcp_access_tokens;
