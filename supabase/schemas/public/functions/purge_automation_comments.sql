CREATE OR REPLACE FUNCTION public.purge_automation_comments (
  p_before timestamp with time zone,
  p_limit  integer
)
  RETURNS integer
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
    with doomed as (
        select c.id
        from public.automation_comments c
        where c.created_at < p_before
        order by c.created_at
        limit p_limit
        for update skip locked
    ),
    deleted as (
        delete from public.automation_comments c
        using doomed
        where c.id = doomed.id
        returning c.id
    )
    select count(*)::integer from deleted;
$function$;

GRANT EXECUTE ON FUNCTION "public"."purge_automation_comments"(timestamp WITH time zone, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."purge_automation_comments"(timestamp WITH time zone, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."purge_automation_comments"(timestamp WITH time zone, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."purge_automation_comments"(timestamp WITH time zone, integer) FROM PUBLIC, "anon", "authenticated";
