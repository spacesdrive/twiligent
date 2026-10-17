-- creates reserve_automation_followup, which checks the account and records an attempt before a follow-up is sent
create or replace function public.reserve_automation_followup(
    p_id text,
    p_attempt_id text,
    p_kind text,
    p_message_digest text default null
)
returns table (outcome text, retry_at timestamptz)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    job public.automation_followups%rowtype;
    controls public.automation_accounts%rowtype;
    rule text;
begin
    select * into job from public.automation_followups f where f.id = p_id and f.status = 'processing' for update;
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

    select c.rule_id into rule from public.automation_comments c where c.id = job.automation_comment_id;
    update public.automation_followups f
    set status = 'sending', claimed_at = now(), attempts = f.attempts + 1, kind = p_kind
    where f.id = p_id;
    insert into public.automation_attempts (id, user_id, account_id, automation_comment_id, rule_id, recipient_id, kind, followup_id, message_digest)
    values (p_attempt_id, job.user_id, job.account_id, job.automation_comment_id, rule, job.recipient_id, 'followup', job.id, p_message_digest);
    return query select 'ok'::text, null::timestamptz;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.reserve_automation_followup(text, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_automation_followup(text, text, text, text) to service_role;
