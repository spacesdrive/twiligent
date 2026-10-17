-- gives the browser roles full access to accounts again, which reopens the hole the migration closed
grant all on table public.accounts to anon, authenticated;
create policy users_own_accounts on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
