CREATE TABLE "public"."youtube_uploads" (
  "id"                 text                     NOT NULL,
  "user_id"            uuid                     NOT NULL,
  "connection_id"      text                     NOT NULL,
  "source_url"         text                     NOT NULL,
  "source_bytes"       bigint                   NOT NULL,
  "content_type"       text                     NOT NULL,
  "thumbnail_url"      text,
  "is_short"           boolean                  NOT NULL DEFAULT false,
  "title"              text                     NOT NULL,
  "description"        text                     NOT NULL DEFAULT ''::text,
  "tags"               text[]                   NOT NULL DEFAULT '{}'::text[],
  "category_id"        text                     NOT NULL DEFAULT '22'::text,
  "privacy"            text                     NOT NULL,
  "publish_at"         timestamp with time zone,
  "made_for_kids"      boolean                  NOT NULL DEFAULT false,
  "synthetic_media"    boolean                  NOT NULL DEFAULT false,
  "notify_subscribers" boolean                  NOT NULL DEFAULT true,
  "state"              text                     NOT NULL DEFAULT 'queued'::text,
  "session_uri"        text,
  "bytes_confirmed"    bigint                   NOT NULL DEFAULT 0,
  "video_id"           text,
  "attempts"           integer                  NOT NULL DEFAULT 0,
  "next_attempt_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "lease_owner"        text,
  "lease_until"        timestamp with time zone,
  "last_error"         text,
  "client_request_id"  text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "youtube_uploads_bytes_confirmed_check" CHECK (((bytes_confirmed >= 0) AND (bytes_confirmed <= source_bytes))),
  CONSTRAINT "youtube_uploads_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES public.youtube_connections(id) ON DELETE CASCADE,
  CONSTRAINT "youtube_uploads_pkey" PRIMARY KEY (id),
  CONSTRAINT "youtube_uploads_privacy_check" CHECK ((privacy = ANY (ARRAY['private'::text, 'unlisted'::text, 'public'::text]))),
  CONSTRAINT "youtube_uploads_publish_at_check" CHECK (((publish_at IS NULL) OR (privacy = 'private'::text))),
  CONSTRAINT "youtube_uploads_source_bytes_check" CHECK ((source_bytes > 0)),
  CONSTRAINT "youtube_uploads_source_url_check" CHECK ((source_url ~ '^https://'::text)),
  CONSTRAINT "youtube_uploads_state_check"
    CHECK
    ((state = ANY (ARRAY['queued'::text, 'uploading'::text, 'processing'::text, 'finalizing'::text, 'done'::text, 'waiting_quota'::text, 'needs_reconnect'::text,
    'needs_review'::text, 'failed'::text, 'cancelled'::text]))),
  CONSTRAINT "youtube_uploads_title_check" CHECK (((char_length(title) >= 1) AND (char_length(title) <= 100))),
  CONSTRAINT "youtube_uploads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "youtube_uploads_user_request_key" UNIQUE (user_id, client_request_id)
);

ALTER TABLE "public"."youtube_uploads"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX youtube_uploads_due_idx ON public.youtube_uploads USING btree (next_attempt_at)
  WHERE (state = ANY (ARRAY['queued'::text, 'uploading'::text, 'processing'::text, 'finalizing'::text, 'waiting_quota'::text]));

CREATE INDEX youtube_uploads_user_created_idx ON public.youtube_uploads USING btree (user_id, created_at DESC);

CREATE TRIGGER youtube_uploads_set_updated_at
  BEFORE UPDATE ON public.youtube_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_uploads" TO "service_role";

REVOKE ALL ON TABLE "public"."youtube_uploads" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."youtube_uploads" TO "postgres";

REVOKE ALL ON TABLE "public"."youtube_uploads" FROM "anon", "authenticated";
