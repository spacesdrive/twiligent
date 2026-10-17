CREATE OR REPLACE FUNCTION public.merge_tracked_post_data (
  p_id      text,
  p_user_id uuid,
  p_patch   jsonb
)
  RETURNS boolean
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
    update public.tracked_posts
    set data = coalesce(data, '{}'::jsonb) || p_patch
    where id = p_id and user_id = p_user_id
    returning true;
$function$;

GRANT EXECUTE ON FUNCTION "public"."merge_tracked_post_data"(text, uuid, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."merge_tracked_post_data"(text, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."merge_tracked_post_data"(text, uuid, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."merge_tracked_post_data"(text, uuid, jsonb) FROM PUBLIC, "anon", "authenticated";
