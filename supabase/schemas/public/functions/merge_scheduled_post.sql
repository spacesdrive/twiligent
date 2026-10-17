CREATE OR REPLACE FUNCTION public.merge_scheduled_post (
  p_id           text,
  p_user_id      uuid,
  p_patch        jsonb,
  p_status       text                     DEFAULT NULL::text,
  p_scheduled_at timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_only_status  text                     DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
    update public.scheduled_posts
    set data = data || p_patch,
        status = coalesce(p_status, status),
        scheduled_at = coalesce(p_scheduled_at, scheduled_at)
    where id = p_id
        and (p_user_id is null or user_id = p_user_id)
        and (p_only_status is null or status = p_only_status)
    returning true;
$function$;

GRANT EXECUTE ON FUNCTION "public"."merge_scheduled_post"(text, uuid, jsonb, text, timestamp WITH time zone, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."merge_scheduled_post"(text, uuid, jsonb, text, timestamp WITH time zone, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."merge_scheduled_post"(text, uuid, jsonb, text, timestamp WITH time zone, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."merge_scheduled_post"(text, uuid, jsonb, text, timestamp WITH time zone, text) FROM PUBLIC, "anon", "authenticated";
