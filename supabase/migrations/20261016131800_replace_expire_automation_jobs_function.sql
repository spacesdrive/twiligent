-- expires up to p_limit replies whose 7 days ran out, up to p_limit follow-ups whose 24 hours ran out and up to
-- p_limit public replies still waiting 7 days after their comment, without a run claiming each one; rows a run holds
-- are skipped and settled by that run. The answer gains public_replies, which the earlier Worker ignores
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
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.expire_automation_jobs(integer) from public, anon, authenticated;
grant execute on function public.expire_automation_jobs(integer) to service_role;
