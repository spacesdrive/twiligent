-- turns on row level security and removes browser access to media_assets
alter table public.media_assets enable row level security;
revoke all on table public.media_assets from anon, authenticated;
