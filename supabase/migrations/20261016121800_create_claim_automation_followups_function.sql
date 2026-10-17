-- creates claim_automation_followups, which hands a run the follow-ups that are due
create or replace function public.claim_automation_followups(
    p_limit integer,
    p_lease_seconds integer,
    p_ids text[] default null
)
returns table (
    id text,
    user_id uuid,
    account_id text,
    automation_comment_id text,
    ig_user_id text,
    recipient_id text,
    attempts integer,
    window_expires_at timestamptz,
    gate_status text,
    gate_prompts integer,
    rule_enabled boolean,
    require_follow boolean,
    reply_text text,
    link_url text,
    not_following_text text,
    access_token text
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    stale_before timestamptz := now() - make_interval(secs => p_lease_seconds);
begin
    -- as with private replies, a send whose run stopped may have arrived, so a person decides
    with interrupted as (
        update public.automation_followups f
        set status = 'needs_review',
            status_reason = 'interrupted',
            claimed_at = null,
            error_message = 'The run stopped while this message was being sent. Check the conversation on Instagram before you retry.'
        where f.status = 'sending' and f.claimed_at < stale_before
        returning f.id
    )
    update public.automation_attempts t
    set outcome = 'ambiguous', finished_at = now()
    where t.followup_id in (select interrupted.id from interrupted) and t.outcome = 'sending';

    return query
    with due_accounts as (
        select distinct f.account_id
        from public.automation_followups f
        where ((f.status in ('queued', 'retry_wait') and f.next_attempt_at <= now())
                or (f.status = 'processing' and f.claimed_at < stale_before))
            and (p_ids is null or f.id = any (p_ids))
    ),
    open_accounts as (
        select d.account_id
        from due_accounts d
        left join public.automation_accounts s on s.account_id = d.account_id
        where s.account_id is null or (not s.paused and (s.cooldown_until is null or s.cooldown_until <= now()))
    ),
    candidates as (
        select x.id, x.due_at, row_number() over (partition by o.account_id order by x.due_at, x.id) as place
        from open_accounts o
        cross join lateral (
            select f.id, coalesce(f.next_attempt_at, f.claimed_at) as due_at
            from public.automation_followups f
            where f.account_id = o.account_id
                and ((f.status in ('queued', 'retry_wait') and f.next_attempt_at <= now())
                    or (f.status = 'processing' and f.claimed_at < stale_before))
                and (p_ids is null or f.id = any (p_ids))
            order by due_at
            limit p_limit
        ) x
    ),
    picked as (
        select f.id
        from public.automation_followups f
        join candidates on candidates.id = f.id
        where (f.status in ('queued', 'retry_wait') and f.next_attempt_at <= now())
            or (f.status = 'processing' and f.claimed_at < stale_before)
        order by candidates.place, candidates.due_at
        limit p_limit
        for update of f skip locked
    ),
    claimed as (
        update public.automation_followups f
        set status = 'processing', claimed_at = now()
        from picked
        where f.id = picked.id
        returning f.id, f.user_id, f.account_id, f.automation_comment_id, f.ig_user_id, f.recipient_id, f.attempts, f.window_expires_at
    )
    select claimed.id, claimed.user_id, claimed.account_id, claimed.automation_comment_id, claimed.ig_user_id,
        claimed.recipient_id, claimed.attempts, claimed.window_expires_at, c.gate_status, c.gate_prompts,
        coalesce(r.enabled, false), coalesce(r.require_follow, false), r.reply_text, r.link_url, r.not_following_text,
        a.data ->> 'accessToken'
    from claimed
    join public.automation_comments c on c.id = claimed.automation_comment_id
    left join public.automation_rules r on r.id = c.rule_id
    left join public.accounts a on a.id = claimed.account_id and a.user_id = claimed.user_id;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.claim_automation_followups(integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.claim_automation_followups(integer, integer, text[]) to service_role;
