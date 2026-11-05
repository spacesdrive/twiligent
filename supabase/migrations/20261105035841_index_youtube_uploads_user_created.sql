-- adds an index that lists a person's uploads newest first
create index youtube_uploads_user_created_idx on public.youtube_uploads (user_id, created_at desc);
