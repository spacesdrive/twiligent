-- removes the trigger that keeps updated_at current on youtube_uploads
drop trigger if exists youtube_uploads_set_updated_at on public.youtube_uploads;
