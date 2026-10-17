CREATE OR REPLACE FUNCTION public.record_automation_public_review (
  p_id       text,
  p_found    boolean,
  p_reply_id text                     DEFAULT NULL::text,
  p_sent_at  timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_note     text                     DEFAULT NULL::text,
  p_resend   boolean                  DEFAULT false
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
    if p_found then
        update public.automation_public_replies p
        set status = 'accepted',
            status_reason = 'confirmed',
            error_message = null,
            reply_id = coalesce(p_reply_id, p.reply_id),
            accepted_at = coalesce(p_sent_at, now()),
            review_checks = p.review_checks + 1,
            review_checked_at = now()
        where p.id = p_id and p.status = 'needs_review' and p.status_reason in ('no_answer', 'interrupted');
        if not found then
            return false;
        end if;
        update public.automation_attempts t
        set outcome = 'accepted', finished_at = coalesce(t.finished_at, now())
        where t.id = (
            select x.id from public.automation_attempts x
            where x.public_reply_id = p_id and x.outcome = 'ambiguous'
            order by x.started_at desc
            limit 1
        );
        return true;
    end if;

    if p_resend then
        update public.automation_public_replies p
        set status = 'queued',
            status_reason = 'resend_after_check',
            error_message = null,
            next_attempt_at = now(),
            claimed_at = null,
            review_checks = 0,
            review_checked_at = null
        where p.id = p_id and p.status = 'needs_review' and p.status_reason in ('no_answer', 'interrupted');
        return found;
    end if;

    update public.automation_public_replies p
    set review_checks = p.review_checks + 1,
        review_checked_at = now(),
        error_message = coalesce(left(p_note, 500), p.error_message)
    where p.id = p_id and p.status = 'needs_review' and p.status_reason in ('no_answer', 'interrupted');
    return found;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."record_automation_public_review"(text, boolean, text, timestamp WITH time zone, text, boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_automation_public_review"(text, boolean, text, timestamp WITH time zone, text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_automation_public_review"(text, boolean, text, timestamp WITH time zone, text, boolean) TO "postgres";

REVOKE ALL ON FUNCTION "public"."record_automation_public_review"(text, boolean, text, timestamp WITH time zone, text, boolean) FROM PUBLIC, "anon", "authenticated";
