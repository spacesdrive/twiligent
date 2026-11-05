-- turns on row level security and removes browser access to youtube_quota_usage
alter table public.youtube_quota_usage enable row level security;
revoke all on table public.youtube_quota_usage from anon, authenticated;
