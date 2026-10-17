-- removes all browser access to scheduled_posts, because only the Worker should read it
drop policy if exists users_own_posts on public.scheduled_posts;
revoke all on table public.scheduled_posts from anon, authenticated;
