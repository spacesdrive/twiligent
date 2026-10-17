-- creates automation_public_review_candidates, which lists public replies of unknown outcome that are ready to be looked for
create or replace function public.automation_public_review_candidates(
    p_limit integer,
    p_settle_seconds integer,
    p_max_checks integer,
    p_recheck_seconds integer
)
returns table (
    id text,
    ig_user_id text,
    comment_id text,
    started_at timestamptz,
    message_digest text,
    access_token text,
    review_checks integer,
    ambiguous_attempts integer
)
language sql
stable
set search_path = ''
as $$
    select p.id, p.ig_user_id, p.comment_id, t.started_at, t.message_digest, a.data ->> 'accessToken', p.review_checks,
        (select count(*)::integer from public.automation_attempts x where x.public_reply_id = p.id and x.outcome = 'ambiguous')
    from public.automation_public_replies p
    join lateral (
        select t.started_at, t.message_digest
        from public.automation_attempts t
        where t.public_reply_id = p.id and t.outcome = 'ambiguous'
        order by t.started_at desc
        limit 1
    ) t on true
    join public.accounts a on a.id = p.account_id and a.user_id = p.user_id
    where p.status = 'needs_review'
        and p.status_reason in ('no_answer', 'interrupted')
        and p.review_checks < p_max_checks
        and (p.review_checked_at is null or p.review_checked_at < now() - make_interval(secs => p_recheck_seconds))
        and t.started_at < now() - make_interval(secs => p_settle_seconds)
    order by p.review_checked_at nulls first, p.updated_at
    limit p_limit;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_public_review_candidates(integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.automation_public_review_candidates(integer, integer, integer, integer) to service_role;
