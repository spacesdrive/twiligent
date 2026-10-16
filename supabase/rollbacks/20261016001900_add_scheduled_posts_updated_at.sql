drop trigger if exists scheduled_posts_set_updated_at on public.scheduled_posts;
alter table public.scheduled_posts drop column if exists updated_at;
