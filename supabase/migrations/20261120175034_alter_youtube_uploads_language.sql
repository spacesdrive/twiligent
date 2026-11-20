-- adds the language a YouTube upload is in, sent to YouTube as the video's and its audio's language
alter table public.youtube_uploads
    add column language text
    constraint youtube_uploads_language_check check (language is null or language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$');
