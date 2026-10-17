CREATE TABLE "public"."accounts" (
  "id"         text                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "platform"   text                     NOT NULL,
  "data"       jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "accounts_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "accounts_id_user_id_key" UNIQUE (id, user_id),
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "accounts_platform_check" CHECK ((platform = ANY (ARRAY['youtube'::text, 'instagram'::text, 'reddit'::text]))),
  CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."accounts"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX accounts_identity_key ON public.accounts USING btree (user_id, platform, (
CASE platform
    WHEN 'youtube'::text THEN (DATA ->> 'channelId'::text)
    WHEN 'reddit'::text THEN (DATA ->> 'username'::text)
    WHEN 'instagram'::text THEN (DATA ->> 'igUserId'::text)
    ELSE NULL::text
END));

CREATE INDEX accounts_instagram_user_idx ON public.accounts USING btree (((DATA ->> 'igUserId'::text)))
  WHERE (platform = 'instagram'::text);

CREATE INDEX accounts_user_id_created_at_idx ON public.accounts USING btree (user_id, created_at, id);

CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts" TO "service_role";

REVOKE ALL ON TABLE "public"."accounts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts" TO "postgres";

REVOKE ALL ON TABLE "public"."accounts" FROM "anon", "authenticated";
