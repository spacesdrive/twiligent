-- turns row level security off on media_assets; it had no browser grants to give back
alter table public.media_assets disable row level security;
