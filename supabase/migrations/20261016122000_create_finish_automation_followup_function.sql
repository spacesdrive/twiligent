-- creates finish_automation_followup, which saves what Instagram answered to a follow-up
create or replace function public.finish_automation_followup(
    p_id text,
    p_attempt_id text,
    p_status text,
    p_outcome text,
    p_reason text default null,
    p_error_message text default null,
    p_message_id text default null,
    p_error_code integer default null,
    p_error_subcode integer default null,
    p_http_status integer default null,
    p_next_attempt_at timestamptz default null,
    p_cooldown_until timestamptz default null,
    p_cooldown_reason text default null,
    p_pause_reason text default null,
    p_gate_status text default null,
    p_count_reminder boolean default false
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
    job public.automation_followups%rowtype;
begin
    update public.automation_followups f
    set status = p_status,
        status_reason = p_reason,
        error_message = p_error_message,
        message_id = coalesce(p_message_id, f.message_id),
        accepted_at = case when p_status = 'accepted' then now() else f.accepted_at end,
        next_attempt_at = p_next_attempt_at,
        claimed_at = null
    where f.id = p_id and (f.status = 'sending' or (f.status = 'needs_review' and f.status_reason = 'interrupted'))
    returning * into job;
    if not found then
        return false;
    end if;

    update public.automation_attempts t
    set outcome = p_outcome,
        error_code = p_error_code,
        error_subcode = p_error_subcode,
        http_status = p_http_status,
        finished_at = now()
    where t.id = p_attempt_id and t.followup_id = p_id;

    update public.automation_comments c
    set gate_status = coalesce(p_gate_status, c.gate_status),
        gate_prompts = c.gate_prompts + case when p_count_reminder then 1 else 0 end
    where c.id = job.automation_comment_id;

    if p_cooldown_until is not null then
        insert into public.automation_accounts (account_id, user_id, cooldown_until, cooldown_reason)
        values (job.account_id, job.user_id, p_cooldown_until, p_cooldown_reason)
        on conflict (account_id) do update
        set cooldown_until = greatest(coalesce(public.automation_accounts.cooldown_until, excluded.cooldown_until), excluded.cooldown_until),
            cooldown_reason = excluded.cooldown_reason;
    end if;

    if p_pause_reason is not null then
        insert into public.automation_accounts (account_id, user_id, paused, paused_reason)
        values (job.account_id, job.user_id, true, p_pause_reason)
        on conflict (account_id) do update set paused = true, paused_reason = excluded.paused_reason;
    end if;
    return true;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.finish_automation_followup(text, text, text, text, text, text, text, integer, integer, integer, timestamptz, timestamptz, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.finish_automation_followup(text, text, text, text, text, text, text, integer, integer, integer, timestamptz, timestamptz, text, text, text, boolean) to service_role;
