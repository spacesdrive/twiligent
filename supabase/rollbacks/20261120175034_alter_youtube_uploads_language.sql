-- removes the language of a YouTube upload
alter table public.youtube_uploads
    drop column if exists language;
