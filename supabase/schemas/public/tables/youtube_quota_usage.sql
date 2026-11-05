CREATE TABLE "public"."youtube_quota_usage" (
  "day"    date    NOT NULL,
  "bucket" text    NOT NULL,
  "units"  integer NOT NULL DEFAULT 0,
  CONSTRAINT "youtube_quota_usage_bucket_check" CHECK ((bucket = ANY (ARRAY['uploads'::text, 'default'::text]))),
  CONSTRAINT "youtube_quota_usage_pkey" PRIMARY KEY (day, bucket),
  CONSTRAINT "youtube_quota_usage_units_check" CHECK ((units >= 0))
);

ALTER TABLE "public"."youtube_quota_usage"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_quota_usage" TO "service_role";

REVOKE ALL ON TABLE "public"."youtube_quota_usage" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_quota_usage" TO "postgres";

REVOKE ALL ON TABLE "public"."youtube_quota_usage" FROM "anon", "authenticated";
