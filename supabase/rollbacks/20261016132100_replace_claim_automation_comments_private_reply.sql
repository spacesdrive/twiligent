-- puts back the claim from 20261016121400, which ignores whether the rule still sends a private reply
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
    access_token text,
    require_follow boolean,
    follow_prompt_text text
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    stale_before timestamptz := now() - make_interval(secs => p_lease_seconds);
begin
    -- a send whose run stopped may have reached Instagram, so a person decides instead of a second send
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
    with recursive waiting_accounts as (
        -- one index probe per account instead of reading every waiting job, however long one account's queue is
        (select c.account_id
        from public.automation_comments c
        where c.status in ('queued', 'retry_wait') and p_ids is null
        order by c.account_id
        limit 1)
        union all
        select (select c.account_id
            from public.automation_comments c
            where c.status in ('queued', 'retry_wait') and c.account_id > w.account_id
            order by c.account_id
            limit 1)
        from waiting_accounts w
        where w.account_id is not null
    ),
    due_accounts as (
        select w.account_id from waiting_accounts w where w.account_id is not null
        union
        select c.account_id from public.automation_comments c where c.id = any (p_ids)
        union
        select c.account_id
        from public.automation_comments c
        where c.status = 'processing' and c.claimed_at < stale_before and (p_ids is null or c.id = any (p_ids))
    ),
    open_accounts as (
        select d.account_id
        from due_accounts d
        left join public.automation_accounts s on s.account_id = d.account_id
        where s.account_id is null
            or (not s.paused
                and (s.cooldown_until is null or s.cooldown_until <= now())
                and (s.limited_until is null or s.limited_until <= now()))
    ),
    -- each account's oldest due jobs, locked as they are read: a job another run holds is skipped, so runs at the
    -- same moment take the next jobs instead of the same ones
    candidates as (
        select x.id, x.account_id, x.next_attempt_at as due_at
        from open_accounts o
        cross join lateral (
            select c.id, c.account_id, c.next_attempt_at
            from public.automation_comments c
            where c.account_id = o.account_id and c.status in ('queued', 'retry_wait') and c.next_attempt_at <= now()
                and (p_ids is null or c.id = any (p_ids))
            order by c.next_attempt_at
            limit p_per_account
            for update of c skip locked
        ) x
        union all
        select x.id, x.account_id, x.claimed_at as due_at
        from open_accounts o
        cross join lateral (
            select c.id, c.account_id, c.claimed_at
            from public.automation_comments c
            where c.account_id = o.account_id and c.status = 'processing' and c.claimed_at < stale_before
                and (p_ids is null or c.id = any (p_ids))
            order by c.claimed_at
            limit p_per_account
            for update of c skip locked
        ) x
    ),
    picked as (
        select ranked.id
        from (
            select candidates.id, candidates.due_at,
                row_number() over (partition by candidates.account_id order by candidates.due_at, candidates.id) as place
            from candidates
        ) ranked
        order by ranked.place, ranked.due_at
        limit p_limit
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
        coalesce(r.enabled, false), r.reply_text, r.link_url, a.data ->> 'accessToken',
        coalesce(r.require_follow, false), r.follow_prompt_text
    from claimed
    left join public.automation_rules r on r.id = claimed.rule_id
    left join public.accounts a on a.id = claimed.account_id and a.user_id = claimed.user_id;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.claim_automation_comments(integer, integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_automation_comments(integer, integer, integer, text[]) to service_role;
