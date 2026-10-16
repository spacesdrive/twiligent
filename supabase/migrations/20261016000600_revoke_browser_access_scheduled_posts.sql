-- only the Worker's service role reads scheduled_posts; the anon key ships in every browser, so browser roles get nothing
drop policy if exists users_own_posts on public.scheduled_posts;
revoke all on table public.scheduled_posts from anon, authenticated;
