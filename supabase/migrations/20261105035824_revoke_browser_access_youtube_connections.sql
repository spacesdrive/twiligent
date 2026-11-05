-- turns on row level security and removes browser access to youtube_connections
alter table public.youtube_connections enable row level security;
revoke all on table public.youtube_connections from anon, authenticated;
