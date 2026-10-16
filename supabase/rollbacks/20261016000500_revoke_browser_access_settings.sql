-- restores the browser access settings had before; only for returning to that state
grant all on table public.settings to anon, authenticated;
create policy users_own_settings on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
