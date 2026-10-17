CREATE OR REPLACE FUNCTION public.reserve_automation_followup (
  p_id             text,
  p_attempt_id     text,
  p_kind           text,
  p_message_digest text DEFAULT NULL::text
)
  RETURNS TABLE (
    outcome  text,
    retry_at timestamp with time zone
  )
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."reserve_automation_followup"(text, text, text, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_automation_followup"(text, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reserve_automation_followup"(text, text, text, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."reserve_automation_followup"(text, text, text, text) FROM PUBLIC, "anon", "authenticated";
