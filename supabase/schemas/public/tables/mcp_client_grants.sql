CREATE TABLE "public"."mcp_client_grants" (
  "id"           text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "client_id"    text                     NOT NULL,
  "client_name"  text                     NOT NULL,
  "permission"   text                     NOT NULL,
  "last_used_at" timestamp with time zone,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mcp_client_grants_client_name_check" CHECK (((char_length(client_name) >= 1) AND (char_length(client_name) <= 200))),
  CONSTRAINT "mcp_client_grants_permission_check" CHECK ((permission = ANY (ARRAY['read'::text, 'write'::text]))),
  CONSTRAINT "mcp_client_grants_pkey" PRIMARY KEY (id),
  CONSTRAINT "mcp_client_grants_user_client_key" UNIQUE (user_id, client_id),
  CONSTRAINT "mcp_client_grants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE "public"."mcp_client_grants"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX mcp_client_grants_user_created_idx ON public.mcp_client_grants USING btree (user_id, created_at DESC);

CREATE TRIGGER mcp_client_grants_set_updated_at
  BEFORE UPDATE ON public.mcp_client_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."mcp_client_grants" TO "service_role";

REVOKE ALL ON TABLE "public"."mcp_client_grants" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."mcp_client_grants" TO "postgres";

REVOKE ALL ON TABLE "public"."mcp_client_grants" FROM "anon", "authenticated";
