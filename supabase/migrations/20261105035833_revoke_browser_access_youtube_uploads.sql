-- turns on row level security and removes browser access to youtube_uploads
alter table public.youtube_uploads enable row level security;
revoke all on table public.youtube_uploads from anon, authenticated;
