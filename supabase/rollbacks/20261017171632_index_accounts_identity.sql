-- removes the rule that allows each account only once per user
drop index if exists public.accounts_identity_key;
