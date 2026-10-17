-- puts back the earlier claim_automation_comments, where accounts do not take turns
drop function if exists public.claim_automation_comments(integer, integer, integer, text[]);
create or replace function public.claim_automation_comments(
    p_limit integer,
    p_per_account integer,
    p_lease_seconds integer,
    p_ids text[] default null
)
returns table (
    id text,
    user_id uuid,
    account_id text,
    rule_id text,
    ig_user_id text,
    comment_id text,
    from_id text,
    attempts integer,
    expires_at timestamptz,
    rule_enabled boolean,
    reply_text text,
    link_url text,
    access_token text
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    stale_before timestamptz := now() - make_interval(secs => p_lease_seconds);
begin
    with interrupted as (
        update public.automation_comments c
        set status = 'needs_review',
            status_reason = 'interrupted',
            claimed_at = null,
            error_message = 'The run stopped while this reply was being sent. Check the conversation on Instagram before you retry.'
        where c.status = 'sending' and c.claimed_at < stale_before
        returning c.id
    )
    update public.automation_attempts t
    set outcome = 'ambiguous', finished_at = now()
    where t.automation_comment_id in (select interrupted.id from interrupted) and t.outcome = 'sending';

    return query
    with due as (
        select c.id, c.account_id, coalesce(c.next_attempt_at, c.claimed_at) as due_at
        from public.automation_comments c
        where ((c.status in ('queued', 'retry_wait') and c.next_attempt_at <= now())
                or (c.status = 'processing' and c.claimed_at < stale_before))
            and (p_ids is null or c.id = any (p_ids))
        order by due_at
        limit p_limit * 10
    ),
    fair as (
        select due.id, due.due_at, row_number() over (partition by due.account_id order by due.due_at) as place
        from due
    ),
    picked as (
        select c.id
        from public.automation_comments c
        join fair on fair.id = c.id
        where fair.place <= p_per_account
            and ((c.status in ('queued', 'retry_wait') and c.next_attempt_at <= now())
                or (c.status = 'processing' and c.claimed_at < stale_before))
        order by fair.due_at
        limit p_limit
        for update of c skip locked
    ),
    claimed as (
        update public.automation_comments c
        set status = 'processing', claimed_at = now()
        from picked
        where c.id = picked.id
        returning c.id, c.user_id, c.account_id, c.rule_id, c.ig_user_id, c.comment_id, c.from_id, c.attempts, c.expires_at
    )
    select claimed.id, claimed.user_id, claimed.account_id, claimed.rule_id, claimed.ig_user_id, claimed.comment_id,
        claimed.from_id, claimed.attempts, claimed.expires_at,
        coalesce(r.enabled, false), r.reply_text, r.link_url, a.data ->> 'accessToken'
    from claimed
    left join public.automation_rules r on r.id = claimed.rule_id
    left join public.accounts a on a.id = claimed.account_id and a.user_id = claimed.user_id;
end;
$$;

revoke execute on function public.claim_automation_comments(integer, integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_automation_comments(integer, integer, integer, text[]) to service_role;
