CREATE OR REPLACE FUNCTION public.merge_account_data (
  p_id      text,
  p_user_id uuid,
  p_patch   jsonb
)
  RETURNS boolean
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
    update public.accounts
    set data = data || p_patch
    where id = p_id and (p_user_id is null or user_id = p_user_id)
    returning true;
$function$;

GRANT EXECUTE ON FUNCTION "public"."merge_account_data"(text, uuid, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."merge_account_data"(text, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."merge_account_data"(text, uuid, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."merge_account_data"(text, uuid, jsonb) FROM PUBLIC, "anon", "authenticated";
