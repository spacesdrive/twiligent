-- only the Worker's service role reads tracked_posts; the anon key ships in every browser, so browser roles get nothing
revoke all on table public.tracked_posts from anon, authenticated;
