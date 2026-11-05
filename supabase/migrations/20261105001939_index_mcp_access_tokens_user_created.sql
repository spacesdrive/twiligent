-- adds an index that lists a person's access tokens newest first
create index mcp_access_tokens_user_created_idx on public.mcp_access_tokens (user_id, created_at desc);
