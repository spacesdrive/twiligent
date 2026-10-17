-- adds an index that finds an account by its Instagram id when a webhook arrives
create index if not exists accounts_instagram_user_idx on public.accounts ((data ->> 'igUserId')) where platform = 'instagram';
