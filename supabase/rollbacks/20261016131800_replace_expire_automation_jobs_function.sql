-- puts back the function from 20261016122300, without the public reply columns
-- expires up to p_limit replies whose 7 days ran out and up to p_limit follow-ups whose 24 hours ran out, without a
-- run claiming each one; rows a run holds are skipped and settled by that run
create or replace function public.expire_automation_jobs(p_limit integer)
returns jsonb
language sql
set search_path = ''
as $$
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
    )
    select jsonb_build_object(
        'comments', (select count(*) from expired_comments),
        'followups', (select count(*) from expired_followups)
    );
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.expire_automation_jobs(integer) from public, anon, authenticated;
grant execute on function public.expire_automation_jobs(integer) to service_role;
