-- adds the trigger that keeps updated_at current on youtube_uploads
create trigger youtube_uploads_set_updated_at before update on public.youtube_uploads
    for each row execute function public.set_updated_at();
