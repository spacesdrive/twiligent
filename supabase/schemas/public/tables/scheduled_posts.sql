CREATE TABLE "public"."scheduled_posts" (
  "id"           text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "account_id"   text                     NOT NULL,
  "status"       text                     NOT NULL DEFAULT 'pending'::text,
  "scheduled_at" timestamp with time zone NOT NULL,
  "data"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "claimed_at"   timestamp with time zone,
  "attempts"     integer                  NOT NULL DEFAULT 0,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scheduled_posts_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "scheduled_posts_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "scheduled_posts_claim_check" CHECK (((status <> 'publishing'::text) OR (claimed_at IS NOT NULL))),
  CONSTRAINT "scheduled_posts_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY (id),
  CONSTRAINT "scheduled_posts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'publishing'::text, 'published'::text, 'failed'::text]))),
  CONSTRAINT "scheduled_posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."scheduled_posts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX scheduled_posts_claimed_idx ON public.scheduled_posts USING btree (claimed_at)
  WHERE (status = 'publishing'::text);

CREATE INDEX scheduled_posts_due_idx ON public.scheduled_posts USING btree (scheduled_at)
  WHERE (status = 'pending'::text);

CREATE INDEX scheduled_posts_user_id_scheduled_at_idx ON public.scheduled_posts USING btree (user_id, scheduled_at);

CREATE TRIGGER scheduled_posts_set_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scheduled_posts" TO "service_role";

REVOKE ALL ON TABLE "public"."scheduled_posts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scheduled_posts" TO "postgres";

REVOKE ALL ON TABLE "public"."scheduled_posts" FROM "anon", "authenticated";
