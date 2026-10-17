CREATE OR REPLACE FUNCTION public.finish_automation_public_reply (
  p_id              text,
  p_attempt_id      text,
  p_status          text,
  p_outcome         text,
  p_reason          text                     DEFAULT NULL::text,
  p_error_message   text                     DEFAULT NULL::text,
  p_reply_id        text                     DEFAULT NULL::text,
  p_error_code      integer                  DEFAULT NULL::integer,
  p_error_subcode   integer                  DEFAULT NULL::integer,
  p_http_status     integer                  DEFAULT NULL::integer,
  p_next_attempt_at timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_cooldown_until  timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_cooldown_reason text                     DEFAULT NULL::text,
  p_pause_reason    text                     DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
    job public.automation_public_replies%rowtype;
begin
    update public.automation_public_replies p
    set status = p_status,
        status_reason = p_reason,
        error_message = p_error_message,
        reply_id = coalesce(p_reply_id, p.reply_id),
        accepted_at = case when p_status = 'accepted' then now() else p.accepted_at end,
        next_attempt_at = p_next_attempt_at,
        claimed_at = null
    where p.id = p_id and (p.status = 'sending' or (p.status = 'needs_review' and p.status_reason = 'interrupted'))
    returning * into job;
    -- a reply already settled keeps the attempt that settled it
    if not found then
        return false;
    end if;

    update public.automation_attempts t
    set outcome = p_outcome,
        error_code = p_error_code,
        error_subcode = p_error_subcode,
        http_status = p_http_status,
        finished_at = now()
    where t.id = p_attempt_id and t.public_reply_id = p_id;

    if p_cooldown_until is not null then
        insert into public.automation_accounts (account_id, user_id, public_cooldown_until, public_cooldown_reason)
        values (job.account_id, job.user_id, p_cooldown_until, p_cooldown_reason)
        on conflict (account_id) do update
        set public_cooldown_until = greatest(coalesce(public.automation_accounts.public_cooldown_until, excluded.public_cooldown_until), excluded.public_cooldown_until),
            public_cooldown_reason = excluded.public_cooldown_reason;
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
  ON FUNCTION "public"."finish_automation_public_reply"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text)
  TO "service_role";

REVOKE ALL
  ON FUNCTION "public"."finish_automation_public_reply"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text)
  FROM "postgres";

GRANT EXECUTE
  ON FUNCTION "public"."finish_automation_public_reply"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text)
  TO "postgres";

REVOKE ALL
  ON FUNCTION "public"."finish_automation_public_reply"(text, text, text, text, text, text, text, integer, integer, integer, timestamp WITH time zone, timestamp
    WITH time zone, text, text)
  FROM PUBLIC, "anon", "authenticated";
