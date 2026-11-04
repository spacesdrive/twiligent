CREATE TABLE "public"."mcp_access_tokens" (
  "id"           text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "label"        text                     NOT NULL,
  "token_hash"   text                     NOT NULL,
  "token_hint"   text                     NOT NULL,
  "permission"   text                     NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at"   timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mcp_access_tokens_label_check" CHECK (((char_length(label) >= 1) AND (char_length(label) <= 80))),
  CONSTRAINT "mcp_access_tokens_permission_check" CHECK ((permission = ANY (ARRAY['read'::text, 'write'::text]))),
  CONSTRAINT "mcp_access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "mcp_access_tokens_token_hash_check" CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "mcp_access_tokens_token_hash_key" UNIQUE (token_hash),
  CONSTRAINT "mcp_access_tokens_token_hint_check" CHECK ((char_length(token_hint) = 4)),
  CONSTRAINT "mcp_access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."mcp_access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX mcp_access_tokens_user_created_idx ON public.mcp_access_tokens USING btree (user_id, created_at DESC);

CREATE TRIGGER mcp_access_tokens_set_updated_at
  BEFORE UPDATE ON public.mcp_access_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."mcp_access_tokens" TO "service_role";

REVOKE ALL ON TABLE "public"."mcp_access_tokens" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."mcp_access_tokens" TO "postgres";

REVOKE ALL ON TABLE "public"."mcp_access_tokens" FROM "anon", "authenticated";
