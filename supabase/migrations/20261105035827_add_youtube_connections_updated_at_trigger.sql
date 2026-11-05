-- adds the trigger that keeps updated_at current on youtube_connections
create trigger youtube_connections_set_updated_at before update on public.youtube_connections
    for each row execute function public.set_updated_at();
