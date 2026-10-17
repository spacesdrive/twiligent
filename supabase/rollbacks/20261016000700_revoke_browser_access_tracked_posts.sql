-- gives the browser roles full access to tracked_posts again, which reopens the hole the migration closed
grant all on table public.tracked_posts to anon, authenticated;
