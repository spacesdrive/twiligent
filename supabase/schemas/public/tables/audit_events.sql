CREATE TABLE "public"."audit_events" (
  "id"           text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "action"       text                     NOT NULL,
  "subject_type" text                     NOT NULL,
  "subject_id"   text,
  "details"      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_events_action_check" CHECK ((action ~ '^[a-z_]+\.[a-z_]+$'::text)),
  CONSTRAINT "audit_events_details_check" CHECK ((jsonb_typeof(details) = 'object'::text)),
  CONSTRAINT "audit_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "audit_events_subject_type_check"
    CHECK ((subject_type = ANY (ARRAY['account'::text, 'automation_rule'::text, 'automation_account'::text, 'automation_comment'::text]))),
  CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."audit_events"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX audit_events_created_at_idx ON public.audit_events USING btree (created_at);

CREATE INDEX audit_events_user_id_created_at_idx ON public.audit_events USING btree (user_id, created_at DESC);

CREATE TRIGGER audit_events_set_updated_at
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_events" TO "service_role";

REVOKE ALL ON TABLE "public"."audit_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_events" TO "postgres";

REVOKE ALL ON TABLE "public"."audit_events" FROM "anon", "authenticated";
