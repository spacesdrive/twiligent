CREATE TABLE "public"."automation_comments" (
  "id"                text                     NOT NULL,
  "user_id"           uuid                     NOT NULL,
  "account_id"        text                     NOT NULL,
  "rule_id"           text,
  "ig_user_id"        text                     NOT NULL,
  "comment_id"        text                     NOT NULL,
  "media_id"          text,
  "from_id"           text,
  "from_username"     text,
  "text"              text,
  "status"            text                     NOT NULL,
  "status_reason"     text,
  "error_message"     text,
  "attempts"          integer                  NOT NULL DEFAULT 0,
  "next_attempt_at"   timestamp with time zone,
  "claimed_at"        timestamp with time zone,
  "message_id"        text,
  "accepted_at"       timestamp with time zone,
  "notified_at"       timestamp with time zone NOT NULL,
  "expires_at"        timestamp with time zone NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "recipient_id"      text,
  "gate_status"       text,
  "gate_prompts"      integer                  NOT NULL DEFAULT 0,
  "review_checks"     integer                  NOT NULL DEFAULT 0,
  "review_checked_at" timestamp with time zone,
  CONSTRAINT "automation_comments_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "automation_comments_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "automation_comments_comment_key" UNIQUE (ig_user_id, comment_id),
  CONSTRAINT "automation_comments_error_message_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 500))),
  CONSTRAINT "automation_comments_gate_prompts_check" CHECK ((gate_prompts >= 0)),
  CONSTRAINT "automation_comments_gate_status_check" CHECK (((gate_status IS NULL) OR (gate_status = ANY (ARRAY['awaiting_reply'::text, 'completed'::text, 'closed'::text])))),
  CONSTRAINT "automation_comments_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_comments_review_checks_check" CHECK ((review_checks >= 0)),
  CONSTRAINT "automation_comments_status_check"
    CHECK
    ((status = ANY (ARRAY['ignored'::text, 'queued'::text, 'processing'::text, 'retry_wait'::text, 'sending'::text, 'accepted'::text, 'failed'::text, 'needs_review'::text,
    'skipped'::text, 'expired'::text]))),
  CONSTRAINT "automation_comments_text_check" CHECK (((text IS NULL) OR (char_length(text) <= 2200))),
  CONSTRAINT "automation_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "automation_comments_waiting_check" CHECK (((status <> ALL (ARRAY['queued'::text, 'retry_wait'::text])) OR (next_attempt_at IS NOT NULL))),
  CONSTRAINT "automation_comments_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL
);

ALTER TABLE "public"."automation_comments"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX automation_comments_awaiting_reply_idx ON public.automation_comments USING btree (ig_user_id, recipient_id, accepted_at)
  WHERE (gate_status = 'awaiting_reply'::text);

CREATE INDEX automation_comments_claimed_idx ON public.automation_comments USING btree (claimed_at)
  WHERE (status = ANY (ARRAY['processing'::text, 'sending'::text]));

CREATE INDEX automation_comments_created_at_idx ON public.automation_comments USING btree (created_at);

CREATE INDEX automation_comments_due_account_idx ON public.automation_comments USING btree (account_id, next_attempt_at)
  WHERE (status = ANY (ARRAY['queued'::text, 'retry_wait'::text]));

CREATE INDEX automation_comments_due_idx ON public.automation_comments USING btree (next_attempt_at)
  WHERE (status = ANY (ARRAY['queued'::text, 'retry_wait'::text]));

CREATE INDEX automation_comments_needs_review_idx ON public.automation_comments USING btree (review_checked_at NULLS FIRST, updated_at)
  WHERE (status = 'needs_review'::text);

CREATE INDEX automation_comments_rule_id_idx ON public.automation_comments USING btree (rule_id)
  WHERE (rule_id IS NOT NULL);

CREATE INDEX automation_comments_user_id_created_at_idx ON public.automation_comments USING btree (user_id, created_at DESC);

CREATE TRIGGER automation_comments_set_updated_at
  BEFORE UPDATE ON public.automation_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_comments" TO "service_role";

REVOKE ALL ON TABLE "public"."automation_comments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_comments" TO "postgres";

REVOKE ALL ON TABLE "public"."automation_comments" FROM "anon", "authenticated";
