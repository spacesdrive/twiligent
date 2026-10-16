-- restores the browser access scheduled_posts had before; only for returning to that state
grant all on table public.scheduled_posts to anon, authenticated;
create policy users_own_posts on public.scheduled_posts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
