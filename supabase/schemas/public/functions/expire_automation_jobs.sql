CREATE OR REPLACE FUNCTION public.expire_automation_jobs (
  p_limit integer
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
    with due_comments as (
        select c.id
        from public.automation_comments c
        where c.status in ('queued', 'retry_wait') and c.expires_at <= now()
        limit p_limit
        for update skip locked
    ),
    expired_comments as (
        update public.automation_comments c
        set status = 'expired',
            status_reason = 'expired',
            error_message = 'The 7 days in which Instagram allows a private reply to this comment ran out.',
            next_attempt_at = null,
            claimed_at = null
        from due_comments
        where c.id = due_comments.id
        returning c.id
    ),
    due_followups as (
        select f.id
        from public.automation_followups f
        where f.status in ('queued', 'retry_wait') and f.window_expires_at <= now()
        limit p_limit
        for update skip locked
    ),
    expired_followups as (
        update public.automation_followups f
        set status = 'expired',
            status_reason = 'expired',
            error_message = 'The 24 hours in which Instagram allows a message after the person''s reply ran out.',
            next_attempt_at = null,
            claimed_at = null
        from due_followups
        where f.id = due_followups.id
        returning f.id
    ),
    due_public_replies as (
        select p.id
        from public.automation_public_replies p
        where p.status in ('queued', 'retry_wait') and p.expires_at <= now()
        limit p_limit
        for update skip locked
    ),
    expired_public_replies as (
        update public.automation_public_replies p
        set status = 'expired',
            status_reason = 'expired',
            error_message = 'This public reply waited 7 days without going out, so Twiligent stopped trying.',
            next_attempt_at = null,
            claimed_at = null
        from due_public_replies
        where p.id = due_public_replies.id
        returning p.id
    )
    select jsonb_build_object(
        'comments', (select count(*) from expired_comments),
        'followups', (select count(*) from expired_followups),
        'public_replies', (select count(*) from expired_public_replies)
    );
$function$;

GRANT EXECUTE ON FUNCTION "public"."expire_automation_jobs"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."expire_automation_jobs"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."expire_automation_jobs"(integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."expire_automation_jobs"(integer) FROM PUBLIC, "anon", "authenticated";
