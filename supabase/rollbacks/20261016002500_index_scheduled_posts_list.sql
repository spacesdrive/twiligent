-- puts back the plain user index on scheduled_posts
create index if not exists scheduled_posts_user_id_idx on public.scheduled_posts (user_id);
drop index if exists public.scheduled_posts_user_id_scheduled_at_idx;
