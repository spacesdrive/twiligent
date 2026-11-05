-- removes reserve_youtube_quota
drop function if exists public.reserve_youtube_quota(date, text, integer, integer);
