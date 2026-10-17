CREATE TABLE "public"."automation_rules" (
  "id"                    text                     NOT NULL,
  "user_id"               uuid                     NOT NULL,
  "account_id"            text                     NOT NULL,
  "name"                  text                     NOT NULL,
  "keywords"              text[]                   NOT NULL,
  "match_mode"            text                     NOT NULL DEFAULT 'contains'::text,
  "case_sensitive"        boolean                  NOT NULL DEFAULT false,
  "media_ids"             text[]                   NOT NULL DEFAULT '{}'::text[],
  "reply_text"            text                     NOT NULL,
  "link_url"              text,
  "enabled"               boolean                  NOT NULL DEFAULT false,
  "hourly_limit"          integer,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "require_follow"        boolean                  NOT NULL DEFAULT false,
  "follow_prompt_text"    text,
  "not_following_text"    text,
  "private_reply_enabled" boolean                  NOT NULL DEFAULT true,
  "public_reply_enabled"  boolean                  NOT NULL DEFAULT false,
  "public_reply_texts"    text[]                   NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT "automation_rules_account_fkey" FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE CASCADE,
  CONSTRAINT "automation_rules_actions_check" CHECK ((private_reply_enabled OR public_reply_enabled)),
  CONSTRAINT "automation_rules_follow_private_check" CHECK (((NOT require_follow) OR private_reply_enabled)),
  CONSTRAINT "automation_rules_follow_prompt_text_check"
    CHECK (((follow_prompt_text IS NULL) OR ((char_length(follow_prompt_text) >= 1) AND (char_length(follow_prompt_text) <= 1000)))),
  CONSTRAINT "automation_rules_follow_texts_check" CHECK (((NOT require_follow) OR ((follow_prompt_text IS NOT NULL) AND (not_following_text IS NOT NULL)))),
  CONSTRAINT "automation_rules_hourly_limit_check" CHECK (((hourly_limit IS NULL) OR ((hourly_limit >= 1) AND (hourly_limit <= 750)))),
  CONSTRAINT "automation_rules_keywords_check" CHECK (
CASE
    WHEN (match_mode = 'any'::text) THEN (cardinality(keywords) = 0)
    ELSE ((cardinality(keywords) >= 1) AND (cardinality(keywords) <= 10))
END),
  CONSTRAINT "automation_rules_link_url_check" CHECK (((link_url IS NULL) OR (link_url ~ '^https://'::text))),
  CONSTRAINT "automation_rules_match_mode_check" CHECK ((match_mode = ANY (ARRAY['contains'::text, 'exact'::text, 'any'::text]))),
  CONSTRAINT "automation_rules_media_ids_check" CHECK ((cardinality(media_ids) <= 50)),
  CONSTRAINT "automation_rules_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80))),
  CONSTRAINT "automation_rules_not_following_text_check"
    CHECK (((not_following_text IS NULL) OR ((char_length(not_following_text) >= 1) AND (char_length(not_following_text) <= 1000)))),
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_rules_public_reply_texts_check"
    CHECK (((cardinality(public_reply_texts) <= 5) AND ((NOT public_reply_enabled) OR (cardinality(public_reply_texts) >= 1)))),
  CONSTRAINT "automation_rules_reply_text_check"
    CHECK ((((char_length(reply_text) >= 1) AND (char_length(reply_text) <= 1000)) OR ((NOT private_reply_enabled) AND (reply_text = ''::text)))),
  CONSTRAINT "automation_rules_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."automation_rules"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX automation_rules_enabled_account_idx ON public.automation_rules USING btree (account_id)
  WHERE enabled;

CREATE INDEX automation_rules_user_id_created_at_idx ON public.automation_rules USING btree (user_id, created_at, id);

CREATE TRIGGER automation_rules_set_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_rules" TO "service_role";

REVOKE ALL ON TABLE "public"."automation_rules" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."automation_rules" TO "postgres";

REVOKE ALL ON TABLE "public"."automation_rules" FROM "anon", "authenticated";
