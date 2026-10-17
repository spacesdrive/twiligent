-- removes the trigger that keeps updated_at current on tracked_posts
drop trigger if exists tracked_posts_set_updated_at on public.tracked_posts;
