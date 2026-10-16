-- only the Worker's service role reads accounts; the anon key ships in every browser, so browser roles get nothing
drop policy if exists users_own_accounts on public.accounts;
revoke all on table public.accounts from anon, authenticated;
