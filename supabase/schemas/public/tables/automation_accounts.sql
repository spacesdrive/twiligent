CREATE TABLE "public"."automation_accounts" (
  "account_id"             text                     NOT NULL,
  "user_id"                uuid                     NOT NULL,
  "paused"                 boolean                  NOT NULL DEFAULT false,
  "paused_reason"          text,
  "cooldown_until"         timestamp with time zone,
  "cooldown_reason"        text,
  "subscribed_at"          timestamp with time zone,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "limited_until"          timestamp with time zone,
  "subscribed_fields"      text[],
  "public_cooldown_until"  timestamp with time zone,
  "public_cooldown_reason" text,
  "public_limited_until"   timestamp with time zone,
  CONSTRAINT "automation_accounts_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "automation_accounts_cooldown_reason_check" CHECK (((cooldown_reason IS NULL) OR (char_length(cooldown_reason) <= 200))),
  CONSTRAINT "automation_accounts_paused_reason_check" CHECK (((paused_reason IS NULL) OR (char_length(paused_reason) <= 200))),
  CONSTRAINT "automation_accounts_pkey" PRIMARY KEY (account_id),
  CONSTRAINT "automation_accounts_public_cooldown_reason_check" CHECK (((public_cooldown_reason IS NULL) OR (char_length(public_cooldown_reason) <= 200))),
  CONSTRAINT "automation_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."automation_accounts"
  ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER automation_accounts_set_updated_at
  BEFORE UPDATE ON public.automation_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_accounts" TO "service_role";

REVOKE ALL ON TABLE "public"."automation_accounts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_accounts" TO "postgres";

REVOKE ALL ON TABLE "public"."automation_accounts" FROM "anon", "authenticated";
