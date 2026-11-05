CREATE TABLE "public"."media_assets" (
  "id"               text                     NOT NULL,
  "user_id"          uuid                     NOT NULL,
  "public_id"        text                     NOT NULL,
  "resource_type"    text                     NOT NULL,
  "url"              text                     NOT NULL,
  "format"           text,
  "bytes"            bigint,
  "width"            integer,
  "height"           integer,
  "duration_seconds" numeric,
  "label"            text                     NOT NULL DEFAULT ''::text,
  "owns_file"        boolean                  NOT NULL DEFAULT false,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "media_assets_label_check" CHECK ((char_length(label) <= 200)),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "media_assets_resource_type_check" CHECK ((resource_type = ANY (ARRAY['image'::text, 'video'::text]))),
  CONSTRAINT "media_assets_url_check" CHECK ((url ~ '^https://'::text)),
  CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "media_assets_user_public_id_key" UNIQUE (user_id, public_id)
);

ALTER TABLE "public"."media_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX media_assets_user_created_idx ON public.media_assets USING btree (user_id, created_at DESC);

CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."media_assets" TO "service_role";

REVOKE ALL ON TABLE "public"."media_assets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."media_assets" TO "postgres";

REVOKE ALL ON TABLE "public"."media_assets" FROM "anon", "authenticated";
