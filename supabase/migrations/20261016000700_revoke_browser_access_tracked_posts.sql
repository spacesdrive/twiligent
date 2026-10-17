-- removes all browser access to tracked_posts, because only the Worker should read it
revoke all on table public.tracked_posts from anon, authenticated;
