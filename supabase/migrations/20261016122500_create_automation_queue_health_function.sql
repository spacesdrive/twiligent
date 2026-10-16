-- the instance's reply queue in one call, each count read through its own partial index: jobs due now and the oldest
-- of them, jobs held by runs that stopped, replies that need review, follow-ups due, and accounts that are held
create or replace function public.automation_queue_health(p_lease_seconds integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
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
        'paused_accounts', (
            select count(*) from public.automation_accounts a where a.paused
        ),
        'limited_accounts', (
            select count(*) from public.automation_accounts a
            where a.cooldown_until > now() or a.limited_until > now()
        )
    );
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_queue_health(integer) from public, anon, authenticated;
grant execute on function public.automation_queue_health(integer) to service_role;
