-- creates record_automation_public_review, which saves whether a public reply of unknown outcome was found
create or replace function public.record_automation_public_review(
    p_id text,
    p_found boolean,
    p_reply_id text default null,
    p_sent_at timestamptz default null,
    p_note text default null,
    p_resend boolean default false
)
returns boolean
language plpgsql
set search_path = ''
as $$
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
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.record_automation_public_review(text, boolean, text, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.record_automation_public_review(text, boolean, text, timestamptz, text, boolean) to service_role;
