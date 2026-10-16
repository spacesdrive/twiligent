-- replies whose outcome was unknown, ready to be looked for in the conversation on Instagram: the last attempt left
-- at least p_settle_seconds ago, fewer than p_max_checks checks so far and none in the last p_recheck_seconds;
-- the least checked first
create or replace function public.automation_review_candidates(
    p_limit integer,
    p_settle_seconds integer,
    p_max_checks integer,
    p_recheck_seconds integer
)
returns table (
    id text,
    ig_user_id text,
    from_id text,
    started_at timestamptz,
    message_digest text,
    access_token text
)
language sql
stable
set search_path = ''
as $$
    select c.id, c.ig_user_id, c.from_id, t.started_at, t.message_digest, a.data ->> 'accessToken'
    from public.automation_comments c
    join lateral (
        select t.started_at, t.message_digest
        from public.automation_attempts t
        where t.automation_comment_id = c.id and t.kind = 'private_reply' and t.outcome = 'ambiguous'
        order by t.started_at desc
        limit 1
    ) t on true
    join public.accounts a on a.id = c.account_id and a.user_id = c.user_id
    where c.status = 'needs_review'
        and c.status_reason in ('no_answer', 'interrupted')
        and c.from_id is not null
        and c.review_checks < p_max_checks
        and (c.review_checked_at is null or c.review_checked_at < now() - make_interval(secs => p_recheck_seconds))
        and t.started_at < now() - make_interval(secs => p_settle_seconds)
    order by c.review_checked_at nulls first, c.updated_at
    limit p_limit;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_review_candidates(integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.automation_review_candidates(integer, integer, integer, integer) to service_role;
