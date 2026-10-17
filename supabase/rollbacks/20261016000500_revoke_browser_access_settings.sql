-- gives the browser roles full access to settings again, which reopens the hole the migration closed
grant all on table public.settings to anon, authenticated;
create policy users_own_settings on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
