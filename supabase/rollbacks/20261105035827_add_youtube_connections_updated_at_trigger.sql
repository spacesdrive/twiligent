-- removes the trigger that keeps updated_at current on youtube_connections
drop trigger if exists youtube_connections_set_updated_at on public.youtube_connections;
