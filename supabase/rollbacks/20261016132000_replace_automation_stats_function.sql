-- puts back the function from 20261016103500, without the public reply columns
-- one user's comment counts by status and request counts by outcome for a period, counted in the database
-- instead of loading every row; p_account_id and p_rule_id narrow it when set
create or replace function public.automation_stats(
    p_user_id uuid,
    p_from timestamptz,
    p_to timestamptz,
    p_account_id text default null,
    p_rule_id text default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'comments', coalesce((
            select jsonb_object_agg(counted.status, counted.total)
            from (
                select c.status, count(*) as total
                from public.automation_comments c
                where c.user_id = p_user_id
                    and c.created_at >= p_from and c.created_at < p_to
                    and (p_account_id is null or c.account_id = p_account_id)
                    and (p_rule_id is null or c.rule_id = p_rule_id)
                group by c.status
            ) counted
        ), '{}'::jsonb),
        'attempts', coalesce((
            select jsonb_object_agg(counted.outcome, counted.total)
            from (
                select t.outcome, count(*) as total
                from public.automation_attempts t
                where t.user_id = p_user_id
                    and t.started_at >= p_from and t.started_at < p_to
                    and (p_account_id is null or t.account_id = p_account_id)
                    and (p_rule_id is null or t.rule_id = p_rule_id)
                group by t.outcome
            ) counted
        ), '{}'::jsonb)
    );
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_stats(uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.automation_stats(uuid, timestamptz, timestamptz, text, text) to service_role;
