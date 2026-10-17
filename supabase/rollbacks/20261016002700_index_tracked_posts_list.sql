-- puts back the plain user index on tracked_posts
create index if not exists tracked_posts_user_id_idx on public.tracked_posts (user_id);
drop index if exists public.tracked_posts_user_id_created_at_idx;
