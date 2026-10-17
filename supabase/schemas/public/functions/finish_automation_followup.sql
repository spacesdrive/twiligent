CREATE OR REPLACE FUNCTION public.finish_automation_followup (
  p_id              text,
  p_attempt_id      text,
  p_status          text,
  p_outcome         text,
  p_reason          text                     DEFAULT NULL::text,
  p_error_message   text                     DEFAULT NULL::text,
  p_message_id      text                     DEFAULT NULL::text,
  p_error_code      integer                  DEFAULT NULL::integer,
  p_error_subcode   integer                  DEFAULT NULL::integer,
  p_http_status     integer                  DEFAULT NULL::integer,
  p_next_attempt_at timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_cooldown_until  timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_cooldown_reason text                     DEFAULT NULL::text,
  p_pause_reason    text                     DEFAULT NULL::text,
  p_gate_status     text                     DEFAULT NULL::text,
  p_count_reminder  boolean                  DEFAULT false
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE
  ON FUNCTION "public"."finish_automation_followup"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text, text, boolean)
  TO "service_role";

REVOKE ALL
  ON FUNCTION "public"."finish_automation_followup"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text, text, boolean)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION "public"."finish_automation_followup"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text, text, boolean)
  TO "postgres";

REVOKE ALL
  ON FUNCTION "public"."finish_automation_followup"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text, text, boolean)
  FROM PUBLIC, "anon", "authenticated";
