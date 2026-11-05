-- removes youtube_quota_usage; the next reservations start counting from zero
drop table if exists public.youtube_quota_usage;
