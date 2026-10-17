CREATE OR REPLACE FUNCTION public.automation_stats (
  p_user_id    uuid,
  p_from       timestamp with time zone,
  p_to         timestamp with time zone,
  p_account_id text                     DEFAULT NULL::text,
  p_rule_id    text                     DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
    select jsonb_build_object(
        'comments', coalesce((
            select jsonb_object_agg(counted.status, counted.total)
            from (
                select c.status, count(*) as total
                from public.automation_comments c
                where c.user_id = p_user_id
                    and c.created_at >= p_from and c.created_at < p_to
                    and (p_account_id is null or c.account_id = p_account_id)
                    and (p_rule_id is null or c.rule_id = p_rule_id)
                group by c.status
            ) counted
        ), '{}'::jsonb),
        'public_replies', coalesce((
            select jsonb_object_agg(counted.status, counted.total)
            from (
                select p.status, count(*) as total
                from public.automation_public_replies p
                where p.user_id = p_user_id
                    and p.created_at >= p_from and p.created_at < p_to
                    and (p_account_id is null or p.account_id = p_account_id)
                    and (p_rule_id is null or p.rule_id = p_rule_id)
                group by p.status
            ) counted
        ), '{}'::jsonb),
        'attempts', coalesce((
            select jsonb_object_agg(counted.outcome, counted.total)
            from (
                select t.outcome, count(*) as total
                from public.automation_attempts t
                where t.user_id = p_user_id
                    and t.started_at >= p_from and t.started_at < p_to
                    and (p_account_id is null or t.account_id = p_account_id)
                    and (p_rule_id is null or t.rule_id = p_rule_id)
                group by t.outcome
            ) counted
        ), '{}'::jsonb)
    );
$function$;

GRANT EXECUTE ON FUNCTION "public"."automation_stats"(uuid, timestamp WITH time zone, timestamp WITH time zone, text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."automation_stats"(uuid, timestamp WITH time zone, timestamp WITH time zone, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."automation_stats"(uuid, timestamp WITH time zone, timestamp WITH time zone, text, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."automation_stats"(uuid, timestamp WITH time zone, timestamp WITH time zone, text, text) FROM PUBLIC, "anon", "authenticated";
