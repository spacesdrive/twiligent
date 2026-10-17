-- replaces the scheduled posts user index with one that also sorts by scheduled time
create index if not exists scheduled_posts_user_id_scheduled_at_idx on public.scheduled_posts (user_id, scheduled_at);
drop index if exists public.scheduled_posts_user_id_idx;
