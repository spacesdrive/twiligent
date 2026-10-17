-- replaces the tracked items user index with one that also sorts by newest first
create index if not exists tracked_posts_user_id_created_at_idx on public.tracked_posts (user_id, created_at desc);
drop index if exists public.tracked_posts_user_id_idx;
