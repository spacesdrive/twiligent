-- turns row level security off on youtube_connections; it had no browser grants to give back
alter table public.youtube_connections disable row level security;
