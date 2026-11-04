CREATE TABLE "public"."tracked_posts" (
  "id"           text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "url"          text                     NOT NULL,
  "label"        text                     NOT NULL DEFAULT ''::text,
  "category"     text                     NOT NULL DEFAULT ''::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "data"         jsonb,
  "content_type" text                     NOT NULL DEFAULT 'youtube'::text,
  CONSTRAINT "tracked_posts_content_type_check" CHECK ((content_type = 'youtube'::text)),
  CONSTRAINT "tracked_posts_data_check" CHECK (((data IS NULL) OR (jsonb_typeof(data) = 'object'::text))),
  CONSTRAINT "tracked_posts_pkey" PRIMARY KEY (id),
  CONSTRAINT "tracked_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."tracked_posts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX tracked_posts_user_id_created_at_idx ON public.tracked_posts USING btree (user_id, created_at DESC);

CREATE TRIGGER tracked_posts_set_updated_at
  BEFORE UPDATE ON public.tracked_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tracked_posts" TO "service_role";

REVOKE ALL ON TABLE "public"."tracked_posts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tracked_posts" TO "postgres";

REVOKE ALL ON TABLE "public"."tracked_posts" FROM "anon", "authenticated";
