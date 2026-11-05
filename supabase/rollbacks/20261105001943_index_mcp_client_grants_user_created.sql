-- removes the index that lists the Claude clients a person approved
drop index if exists public.mcp_client_grants_user_created_idx;
