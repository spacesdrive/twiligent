CREATE OR REPLACE FUNCTION public.automation_queue_health (
  p_lease_seconds integer
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
    select jsonb_build_object(
        'due', (
            select count(*) from public.automation_comments c
            where c.status in ('queued', 'retry_wait') and c.next_attempt_at <= now()
        ),
        'oldest_due_at', (
            select min(c.next_attempt_at) from public.automation_comments c
            where c.status in ('queued', 'retry_wait') and c.next_attempt_at <= now()
        ),
        'waiting', (
            select count(*) from public.automation_comments c where c.status in ('queued', 'retry_wait')
        ),
        'stale', (
            select count(*) from public.automation_comments c
            where c.status in ('processing', 'sending') and c.claimed_at < now() - make_interval(secs => p_lease_seconds)
        ),
        'needs_review', (
            select count(*) from public.automation_comments c where c.status = 'needs_review'
        ),
        'followups_due', (
            select count(*) from public.automation_followups f
            where f.status in ('queued', 'retry_wait') and f.next_attempt_at <= now()
        ),
        'public_due', (
            select count(*) from public.automation_public_replies p
            where p.status in ('queued', 'retry_wait') and p.next_attempt_at <= now()
        ),
        'public_oldest_due_at', (
            select min(p.next_attempt_at) from public.automation_public_replies p
            where p.status in ('queued', 'retry_wait') and p.next_attempt_at <= now()
        ),
        'public_stale', (
            select count(*) from public.automation_public_replies p
            where p.status in ('processing', 'sending') and p.claimed_at < now() - make_interval(secs => p_lease_seconds)
        ),
        'public_needs_review', (
            select count(*) from public.automation_public_replies p where p.status = 'needs_review'
        ),
        'paused_accounts', (
            select count(*) from public.automation_accounts a where a.paused
        ),
        'limited_accounts', (
            select count(*) from public.automation_accounts a
            where a.cooldown_until > now() or a.limited_until > now()
                or a.public_cooldown_until > now() or a.public_limited_until > now()
        )
    );
$function$;

GRANT EXECUTE ON FUNCTION "public"."automation_queue_health"(integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."automation_queue_health"(integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."automation_queue_health"(integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."automation_queue_health"(integer) FROM PUBLIC, "anon", "authenticated";
