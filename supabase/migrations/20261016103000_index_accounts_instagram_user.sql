-- a webhook names the Instagram account by its id, which lives in data, so the lookup needs its own index
create index if not exists accounts_instagram_user_idx on public.accounts ((data ->> 'igUserId')) where platform = 'instagram';
