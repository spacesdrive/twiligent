CREATE TABLE "public"."youtube_connections" (
  "id"                      text                     NOT NULL,
  "user_id"                 uuid                     NOT NULL,
  "account_id"              text,
  "channel_id"              text                     NOT NULL,
  "channel_title"           text                     NOT NULL DEFAULT ''::text,
  "scopes"                  text[]                   NOT NULL DEFAULT '{}'::text[],
  "status"                  text                     NOT NULL DEFAULT 'active'::text,
  "refresh_token_enc"       text                     NOT NULL,
  "access_token_enc"        text,
  "access_token_expires_at" timestamp with time zone,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "youtube_connections_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE SET NULL (account_id),
  CONSTRAINT "youtube_connections_pkey" PRIMARY KEY (id),
  CONSTRAINT "youtube_connections_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'needs_reconnect'::text]))),
  CONSTRAINT "youtube_connections_user_channel_key" UNIQUE (user_id, channel_id),
  CONSTRAINT "youtube_connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."youtube_connections"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER youtube_connections_set_updated_at
  BEFORE UPDATE ON public.youtube_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_connections" TO "service_role";

REVOKE ALL ON TABLE "public"."youtube_connections" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_connections" TO "postgres";

REVOKE ALL ON TABLE "public"."youtube_connections" FROM "anon", "authenticated";
