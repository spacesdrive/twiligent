CREATE TABLE "public"."automation_followups" (
  "id"                    text                     NOT NULL,
  "user_id"               uuid                     NOT NULL,
  "account_id"            text                     NOT NULL,
  "automation_comment_id" text                     NOT NULL,
  "ig_user_id"            text                     NOT NULL,
  "recipient_id"          text                     NOT NULL,
  "trigger_message_id"    text                     NOT NULL,
  "status"                text                     NOT NULL,
  "status_reason"         text,
  "error_message"         text,
  "kind"                  text,
  "attempts"              integer                  NOT NULL DEFAULT 0,
  "next_attempt_at"       timestamp with time zone,
  "claimed_at"            timestamp with time zone,
  "message_id"            text,
  "accepted_at"           timestamp with time zone,
  "window_expires_at"     timestamp with time zone NOT NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "automation_followups_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "automation_followups_attempts_check" CHECK ((attempts >= 0)),
  CONSTRAINT "automation_followups_automation_comment_id_fkey" FOREIGN KEY (automation_comment_id) REFERENCES public.automation_comments(id) ON DELETE CASCADE,
  CONSTRAINT "automation_followups_error_message_check" CHECK (((error_message IS NULL) OR (char_length(error_message) <= 500))),
  CONSTRAINT "automation_followups_kind_check" CHECK (((kind IS NULL) OR (kind = ANY (ARRAY['link'::text, 'reminder'::text])))),
  CONSTRAINT "automation_followups_message_key" UNIQUE (ig_user_id, trigger_message_id),
  CONSTRAINT "automation_followups_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_followups_status_check"
    CHECK
    ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'retry_wait'::text, 'sending'::text, 'accepted'::text, 'failed'::text, 'needs_review'::text, 'skipped'::text,
    'expired'::text]))),
  CONSTRAINT "automation_followups_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "automation_followups_waiting_check" CHECK (((status <> ALL (ARRAY['queued'::text, 'retry_wait'::text])) OR (next_attempt_at IS NOT NULL)))
);

ALTER TABLE "public"."automation_followups"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX automation_followups_claimed_idx ON public.automation_followups USING btree (claimed_at)
  WHERE (status = ANY (ARRAY['processing'::text, 'sending'::text]));

CREATE INDEX automation_followups_comment_id_idx ON public.automation_followups USING btree (automation_comment_id, created_at);

CREATE INDEX automation_followups_due_idx ON public.automation_followups USING btree (account_id, next_attempt_at)
  WHERE (status = ANY (ARRAY['queued'::text, 'retry_wait'::text]));

CREATE UNIQUE INDEX automation_followups_open_comment_key ON public.automation_followups USING btree (automation_comment_id)
  WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text, 'retry_wait'::text, 'sending'::text]));

CREATE TRIGGER automation_followups_set_updated_at
  BEFORE UPDATE ON public.automation_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_followups" TO "service_role";

REVOKE ALL ON TABLE "public"."automation_followups" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_followups" TO "postgres";

REVOKE ALL ON TABLE "public"."automation_followups" FROM "anon", "authenticated";
