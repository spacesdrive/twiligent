-- creates claim_automation_public_replies, which hands a run the public replies that are due to be posted
create or replace function public.claim_automation_public_replies(
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
    attempts integer,
    expires_at timestamptz,
    reply_text text,
    rule_enabled boolean,
    access_token text
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    stale_before timestamptz := now() - make_interval(secs => p_lease_seconds);
begin
    -- a reply whose run stopped while sending may be on Instagram; the review reads the comment's replies to find out
    with interrupted as (
        update public.automation_public_replies p
        set status = 'needs_review',
            status_reason = 'interrupted',
            claimed_at = null,
            error_message = 'The run stopped while this public reply was being sent. Twiligent checks the comment''s replies on Instagram.'
        where p.status = 'sending' and p.claimed_at < stale_before
        returning p.id
    )
    update public.automation_attempts t
    set outcome = 'ambiguous', finished_at = now()
    where t.public_reply_id in (select interrupted.id from interrupted) and t.outcome = 'sending';

    return query
    with recursive waiting_accounts as (
        -- one index probe per account instead of reading every waiting reply
        (select p.account_id
        from public.automation_public_replies p
        where p.status in ('queued', 'retry_wait') and p_ids is null
        order by p.account_id
        limit 1)
        union all
        select (select p.account_id
            from public.automation_public_replies p
            where p.status in ('queued', 'retry_wait') and p.account_id > w.account_id
            order by p.account_id
            limit 1)
        from waiting_accounts w
        where w.account_id is not null
    ),
    due_accounts as (
        select w.account_id from waiting_accounts w where w.account_id is not null
        union
        select p.account_id from public.automation_public_replies p where p.id = any (p_ids)
        union
        select p.account_id
        from public.automation_public_replies p
        where p.status = 'processing' and p.claimed_at < stale_before and (p_ids is null or p.id = any (p_ids))
    ),
    open_accounts as (
        select d.account_id
        from due_accounts d
        left join public.automation_accounts s on s.account_id = d.account_id
        where s.account_id is null
            or (not s.paused
                and (s.public_cooldown_until is null or s.public_cooldown_until <= now())
                and (s.public_limited_until is null or s.public_limited_until <= now()))
    ),
    -- locked as they are read, so runs at the same moment take different replies
    candidates as (
        select x.id, x.account_id, x.next_attempt_at as due_at
        from open_accounts o
        cross join lateral (
            select p.id, p.account_id, p.next_attempt_at
            from public.automation_public_replies p
            where p.account_id = o.account_id and p.status in ('queued', 'retry_wait') and p.next_attempt_at <= now()
                and (p_ids is null or p.id = any (p_ids))
            order by p.next_attempt_at
            limit p_per_account
            for update of p skip locked
        ) x
        union all
        select x.id, x.account_id, x.claimed_at as due_at
        from open_accounts o
        cross join lateral (
            select p.id, p.account_id, p.claimed_at
            from public.automation_public_replies p
            where p.account_id = o.account_id and p.status = 'processing' and p.claimed_at < stale_before
                and (p_ids is null or p.id = any (p_ids))
            order by p.claimed_at
            limit p_per_account
            for update of p skip locked
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
        update public.automation_public_replies p
        set status = 'processing', claimed_at = now()
        from picked
        where p.id = picked.id
        returning p.id, p.user_id, p.account_id, p.rule_id, p.ig_user_id, p.comment_id, p.attempts, p.expires_at, p.reply_text
    )
    select claimed.id, claimed.user_id, claimed.account_id, claimed.rule_id, claimed.ig_user_id, claimed.comment_id,
        claimed.attempts, claimed.expires_at, claimed.reply_text,
        coalesce(r.enabled and r.public_reply_enabled, false), a.data ->> 'accessToken'
    from claimed
    left join public.automation_rules r on r.id = claimed.rule_id
    left join public.accounts a on a.id = claimed.account_id and a.user_id = claimed.user_id;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.claim_automation_public_replies(integer, integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_automation_public_replies(integer, integer, integer, text[]) to service_role;
