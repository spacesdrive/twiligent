-- removes all browser access to accounts, because only the Worker should read it
drop policy if exists users_own_accounts on public.accounts;
revoke all on table public.accounts from anon, authenticated;
