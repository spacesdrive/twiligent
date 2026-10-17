-- gives the browser roles full access to scheduled_posts again, which reopens the hole the migration closed
grant all on table public.scheduled_posts to anon, authenticated;
create policy users_own_posts on public.scheduled_posts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
