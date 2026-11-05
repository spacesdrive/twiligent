-- removes mcp_client_grants, which stops every Claude client signed in with OAuth until it is approved again
drop table if exists public.mcp_client_grants;
