-- puts back the earlier reserve_automation_send, which counts every attempt
drop function if exists public.reserve_automation_send(text, text, integer, integer, integer, integer, text);
create or replace function public.reserve_automation_send(
    p_id text,
    p_attempt_id text,
    p_global_limit integer,
    p_user_limit integer,
    p_account_limit integer,
    p_recipient_limit integer
)
returns table (outcome text, retry_at timestamptz)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    job public.automation_comments%rowtype;
    controls public.automation_accounts%rowtype;
    rule_limit integer;
    hour_ago timestamptz := now() - interval '1 hour';
    free_at timestamptz;
begin
    perform pg_advisory_xact_lock(hashtext('reserve_automation_send'));

    select * into job from public.automation_comments c where c.id = p_id and c.status = 'processing' for update;
    if not found then
        return query select 'gone'::text, null::timestamptz;
        return;
    end if;

    select * into controls from public.automation_accounts a where a.account_id = job.account_id;
    if controls.paused then
        return query select 'paused'::text, null::timestamptz;
        return;
    end if;
    if controls.cooldown_until > now() then
        return query select 'cooldown'::text, controls.cooldown_until;
        return;
    end if;

    if job.from_id is not null and (
        select count(distinct t.automation_comment_id) from public.automation_attempts t
        where t.account_id = job.account_id and t.recipient_id = job.from_id
            and t.started_at > now() - interval '1 day' and t.automation_comment_id <> job.id
    ) >= p_recipient_limit then
        return query select 'recipient_limit'::text, null::timestamptz;
        return;
    end if;

    select r.hourly_limit into rule_limit from public.automation_rules r where r.id = job.rule_id;
    if rule_limit is not null then
        select case when count(*) >= rule_limit then min(t.started_at) + interval '1 hour' end into free_at
        from public.automation_attempts t where t.rule_id = job.rule_id and t.started_at > hour_ago;
        if free_at is not null then
            return query select 'rule_limit'::text, free_at;
            return;
        end if;
    end if;

    select case when count(*) >= p_account_limit then min(t.started_at) + interval '1 hour' end into free_at
    from public.automation_attempts t where t.account_id = job.account_id and t.started_at > hour_ago;
    if free_at is not null then
        return query select 'account_limit'::text, free_at;
        return;
    end if;

    select case when count(*) >= p_user_limit then min(t.started_at) + interval '1 hour' end into free_at
    from public.automation_attempts t where t.user_id = job.user_id and t.started_at > hour_ago;
    if free_at is not null then
        return query select 'user_limit'::text, free_at;
        return;
    end if;

    select case when count(*) >= p_global_limit then min(t.started_at) + interval '1 hour' end into free_at
    from public.automation_attempts t where t.started_at > hour_ago;
    if free_at is not null then
        return query select 'global_limit'::text, free_at;
        return;
    end if;

    update public.automation_comments c
    set status = 'sending', claimed_at = now(), attempts = c.attempts + 1
    where c.id = p_id;
    insert into public.automation_attempts (id, user_id, account_id, automation_comment_id, rule_id, recipient_id)
    values (p_attempt_id, job.user_id, job.account_id, job.id, job.rule_id, job.from_id);
    return query select 'ok'::text, null::timestamptz;
end;
$$;

revoke execute on function public.reserve_automation_send(text, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_automation_send(text, text, integer, integer, integer, integer) to service_role;
