-- creates youtube_quota_usage, the YouTube Data API units the instance's Google project used per Pacific day and bucket
create table public.youtube_quota_usage (
    day date not null,
    -- uploads: videos.insert calls, 100 a day; default: every other call, 10,000 units a day
    bucket text not null,
    units integer not null default 0,
    constraint youtube_quota_usage_pkey primary key (day, bucket),
    constraint youtube_quota_usage_bucket_check check (bucket in ('uploads', 'default')),
    constraint youtube_quota_usage_units_check check (units >= 0)
);
