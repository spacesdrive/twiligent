CREATE TABLE "public"."automation_public_replies" (
  "id"                    text                     NOT NULL,
  "user_id"               uuid                     NOT NULL,
  "account_id"            text                     NOT NULL,
  "automation_comment_id" text                     NOT NULL,
  "rule_id"               text,
  "ig_user_id"            text                     NOT NULL,
  "comment_id"            text                     NOT NULL,
  "media_id"              text,
  "from_id"               text,
  "reply_text"            text                     NOT NULL,
  "status"                text                     NOT NULL,
  "status_reason"         text,
  "error_message"         text,
  "attempts"              integer                  NOT NULL DEFAULT 0,
  "next_attempt_at"       timestamp with time zone,
  "claimed_at"            timestamp with time zone,
  "reply_id"              text,
  "accepted_at"           timestamp with time zone,
  "review_checks"         integer                  NOT NULL DEFAULT 0,
  "review_checked_at"     timestamp with time zone,
  "expires_at"            timestamp with time zone NOT NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "automation_public_replies_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "automation_public_replies_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "automation_public_replies_automation_comment_id_fkey" FOREIGN KEY (automation_comment_id) REFERENCES public.automation_comments(id) ON DELETE CASCADE,
  CONSTRAINT "automation_public_replies_comment_key" UNIQUE (automation_comment_id),
  CONSTRAINT "automation_public_replies_error_message_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 500))),
  CONSTRAINT "automation_public_replies_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_public_replies_reply_text_check" CHECK (((char_length(reply_text) >= 1) AND (char_length(reply_text) <= 2200))),
  CONSTRAINT "automation_public_replies_review_checks_check" CHECK ((review_checks >= 0)),
  CONSTRAINT "automation_public_replies_status_check"
    CHECK
    ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'retry_wait'::text, 'sending'::text, 'accepted'::text, 'failed'::text, 'needs_review'::text, 'skipped'::text,
    'expired'::text]))),
  CONSTRAINT "automation_public_replies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "automation_public_replies_waiting_check" CHECK (((status <> ALL (ARRAY['queued'::text, 'retry_wait'::text])) OR (next_attempt_at IS NOT NULL))),
  CONSTRAINT "automation_public_replies_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL
);

ALTER TABLE "public"."automation_public_replies"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX automation_public_replies_claimed_idx ON public.automation_public_replies USING btree (claimed_at)
  WHERE (status = ANY (ARRAY['processing'::text, 'sending'::text]));

CREATE INDEX automation_public_replies_due_account_idx ON public.automation_public_replies USING btree (account_id, next_attempt_at)
  WHERE (status = ANY (ARRAY['queued'::text, 'retry_wait'::text]));

CREATE INDEX automation_public_replies_needs_review_idx ON public.automation_public_replies USING btree (review_checked_at NULLS FIRST, updated_at)
  WHERE (status = 'needs_review'::text);

CREATE INDEX automation_public_replies_recipient_idx ON public.automation_public_replies USING btree (account_id, from_id, media_id, created_at)
  WHERE (status = ANY (ARRAY['sending'::text, 'accepted'::text, 'needs_review'::text]));

CREATE INDEX automation_public_replies_user_created_idx ON public.automation_public_replies USING btree (user_id, created_at);

CREATE TRIGGER automation_public_replies_set_updated_at
  BEFORE UPDATE ON public.automation_public_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_public_replies" TO "service_role";

REVOKE ALL ON TABLE "public"."automation_public_replies" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_public_replies" TO "postgres";

REVOKE ALL ON TABLE "public"."automation_public_replies" FROM "anon", "authenticated";
