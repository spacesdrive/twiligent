CREATE OR REPLACE FUNCTION public.automation_review_candidates (
  p_limit           integer,
  p_settle_seconds  integer,
  p_max_checks      integer,
  p_recheck_seconds integer
)
  RETURNS TABLE (
    id             text,
    ig_user_id     text,
    from_id        text,
    started_at     timestamp with time zone,
    message_digest text,
    access_token   text,
    review_checks  integer
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
    select c.id, c.ig_user_id, c.from_id, t.started_at, t.message_digest, a.data ->> 'accessToken', c.review_checks
    from public.automation_comments c
    join lateral (
        select t.started_at, t.message_digest
        from public.automation_attempts t
        where t.automation_comment_id = c.id and t.kind = 'private_reply' and t.outcome = 'ambiguous'
        order by t.started_at desc
        limit 1
    ) t on true
    join public.accounts a on a.id = c.account_id and a.user_id = c.user_id
    where c.status = 'needs_review'
        and c.status_reason in ('no_answer', 'interrupted')
        and c.from_id is not null
        and c.review_checks < p_max_checks
        and (c.review_checked_at is null or c.review_checked_at < now() - make_interval(secs => p_recheck_seconds))
        and t.started_at < now() - make_interval(secs => p_settle_seconds)
    order by c.review_checked_at nulls first, c.updated_at
    limit p_limit;
$function$;

GRANT EXECUTE ON FUNCTION "public"."automation_review_candidates"(integer, integer, integer, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."automation_review_candidates"(integer, integer, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."automation_review_candidates"(integer, integer, integer, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."automation_review_candidates"(integer, integer, integer, integer) FROM PUBLIC, "anon", "authenticated";
