CREATE TABLE "public"."automation_attempts" (
  "id"                    text                     NOT NULL,
  "user_id"               uuid                     NOT NULL,
  "account_id"            text                     NOT NULL,
  "automation_comment_id" text                     NOT NULL,
  "rule_id"               text,
  "recipient_id"          text,
  "outcome"               text                     NOT NULL DEFAULT 'sending'::text,
  "error_code"            integer,
  "error_subcode"         integer,
  "http_status"           integer,
  "started_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at"           timestamp with time zone,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "kind"                  text                     NOT NULL DEFAULT 'private_reply'::text,
  "message_digest"        text,
  "followup_id"           text,
  "public_reply_id"       text,
  CONSTRAINT "automation_attempts_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "automation_attempts_followup_check" CHECK (((kind = 'followup'::text) = (followup_id IS NOT NULL))),
  CONSTRAINT "automation_attempts_kind_check" CHECK ((kind = ANY (ARRAY['private_reply'::text, 'followup'::text, 'public_reply'::text]))),
  CONSTRAINT "automation_attempts_outcome_check" CHECK ((outcome = ANY (ARRAY['sending'::text, 'accepted'::text, 'rejected'::text, 'rate_limited'::text, 'ambiguous'::text]))),
  CONSTRAINT "automation_attempts_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_attempts_public_reply_check" CHECK (((kind = 'public_reply'::text) = (public_reply_id IS NOT NULL))),
  CONSTRAINT "automation_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "automation_attempts_automation_comment_id_fkey" FOREIGN KEY (automation_comment_id) REFERENCES public.automation_comments(id) ON DELETE CASCADE,
  CONSTRAINT "automation_attempts_followup_id_fkey" FOREIGN KEY (followup_id) REFERENCES public.automation_followups(id) ON DELETE CASCADE,
  CONSTRAINT "automation_attempts_public_reply_id_fkey" FOREIGN KEY (public_reply_id) REFERENCES public.automation_public_replies(id) ON DELETE CASCADE,
  CONSTRAINT "automation_attempts_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL
);

ALTER TABLE "public"."automation_attempts"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX automation_attempts_account_id_started_at_idx ON public.automation_attempts USING btree (account_id, started_at);

CREATE INDEX automation_attempts_comment_idx ON public.automation_attempts USING btree (automation_comment_id);

CREATE INDEX automation_attempts_public_reply_idx ON public.automation_attempts USING btree (public_reply_id)
  WHERE (public_reply_id IS NOT NULL);

CREATE INDEX automation_attempts_recipient_idx ON public.automation_attempts USING btree (account_id, recipient_id, started_at);

CREATE INDEX automation_attempts_rule_id_started_at_idx ON public.automation_attempts USING btree (rule_id, started_at)
  WHERE (rule_id IS NOT NULL);

CREATE INDEX automation_attempts_started_at_idx ON public.automation_attempts USING btree (started_at);

CREATE INDEX automation_attempts_user_id_started_at_idx ON public.automation_attempts USING btree (user_id, started_at);

CREATE TRIGGER automation_attempts_set_updated_at
  BEFORE UPDATE ON public.automation_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_attempts" TO "service_role";

REVOKE ALL ON TABLE "public"."automation_attempts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_attempts" TO "postgres";

REVOKE ALL ON TABLE "public"."automation_attempts" FROM "anon", "authenticated";
