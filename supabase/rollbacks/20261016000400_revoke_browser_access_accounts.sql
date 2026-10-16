-- restores the browser access accounts had before; only for returning to that state
grant all on table public.accounts to anon, authenticated;
create policy users_own_accounts on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
