-- turns row level security off on youtube_uploads; it had no browser grants to give back
alter table public.youtube_uploads disable row level security;
