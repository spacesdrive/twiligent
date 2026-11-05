create table public.youtube_quota_usage (
    day date not null,
    -- uploads: videos.insert calls, 100 a day; default: every other call, 10,000 units a day
    bucket text not null,
    units integer not null default 0,
    constraint youtube_quota_usage_pkey primary key (day, bucket),
    constraint youtube_quota_usage_bucket_check check (bucket in ('uploads', 'default')),
    constraint youtube_quota_usage_units_check check (units >= 0)
);

ALTER TABLE "public"."youtube_quota_usage"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_quota_usage" TO "service_role";

REVOKE ALL ON TABLE "public"."youtube_quota_usage" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_quota_usage" TO "postgres";

REVOKE ALL ON TABLE "public"."youtube_quota_usage" FROM "anon", "authenticated";
