CREATE OR REPLACE FUNCTION public.record_automation_review (
  p_id         text,
  p_found      boolean,
  p_message_id text                     DEFAULT NULL::text,
  p_sent_at    timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_note       text                     DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
    job public.automation_comments%rowtype;
begin
    if p_found then
        update public.automation_comments c
        set status = 'accepted',
            status_reason = 'confirmed',
            error_message = null,
            message_id = coalesce(p_message_id, c.message_id),
            accepted_at = coalesce(p_sent_at, now()),
            recipient_id = coalesce(c.recipient_id, c.from_id),
            gate_status = case
                when (select r.require_follow from public.automation_rules r where r.id = c.rule_id) then 'awaiting_reply'
                else c.gate_status
            end,
            review_checks = c.review_checks + 1,
            review_checked_at = now()
        where c.id = p_id and c.status = 'needs_review' and c.status_reason in ('no_answer', 'interrupted')
        returning * into job;
        if not found then
            return false;
        end if;
        update public.automation_attempts t
        set outcome = 'accepted', finished_at = coalesce(t.finished_at, now())
        where t.automation_comment_id = p_id and t.kind = 'private_reply' and t.outcome = 'ambiguous';
        return true;
    end if;

    update public.automation_comments c
    set review_checks = c.review_checks + 1,
        review_checked_at = now(),
        error_message = coalesce(left(p_note, 500), c.error_message)
    where c.id = p_id and c.status = 'needs_review' and c.status_reason in ('no_answer', 'interrupted');
    return found;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_automation_review"(text, boolean, text, timestamp WITH time zone, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_automation_review"(text, boolean, text, timestamp WITH time zone, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_automation_review"(text, boolean, text, timestamp WITH time zone, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."record_automation_review"(text, boolean, text, timestamp WITH time zone, text) FROM PUBLIC, "anon", "authenticated";
