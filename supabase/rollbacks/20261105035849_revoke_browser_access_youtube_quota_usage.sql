-- turns row level security off on youtube_quota_usage; it had no browser grants to give back
alter table public.youtube_quota_usage disable row level security;
