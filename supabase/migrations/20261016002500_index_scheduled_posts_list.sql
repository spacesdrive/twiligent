-- scheduledPosts.listForUser: where user_id = $1 order by scheduled_at; the counts behind delete all use it too
create index if not exists scheduled_posts_user_id_scheduled_at_idx on public.scheduled_posts (user_id, scheduled_at);
drop index if exists public.scheduled_posts_user_id_idx;
