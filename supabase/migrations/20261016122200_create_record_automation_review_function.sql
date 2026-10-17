-- creates record_automation_review, which saves whether a reply of unknown outcome was found on Instagram
create or replace function public.record_automation_review(
    p_id text,
    p_found boolean,
    p_message_id text default null,
    p_sent_at timestamptz default null,
    p_note text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
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
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.record_automation_review(text, boolean, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_automation_review(text, boolean, text, timestamptz, text) to service_role;
