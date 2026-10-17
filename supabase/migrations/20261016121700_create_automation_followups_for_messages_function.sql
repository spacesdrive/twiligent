-- creates automation_followups_for_messages, which turns answers to followers-only replies into follow-up jobs
create or replace function public.automation_followups_for_messages(p_ig_user_id text, p_messages jsonb)
returns table (id text)
language sql
set search_path = ''
as $$
    with incoming as (
        select m.id, m.sender_id, m.message_id, m.sent_at
        from jsonb_to_recordset(p_messages) as m (id text, sender_id text, message_id text, sent_at timestamptz)
        where m.id is not null and m.sender_id is not null and m.message_id is not null and m.sent_at is not null
    ),
    waiting as (
        -- the sender's newest reply that waits for them; a minute of slack covers the two clocks, and a reply older
        -- than 7 days no longer waits
        select distinct on (i.message_id)
            i.id as followup_id, i.message_id, i.sent_at, c.id as comment_id, c.user_id, c.account_id, c.recipient_id
        from incoming i
        join public.automation_comments c
            on c.ig_user_id = p_ig_user_id and c.recipient_id = i.sender_id and c.gate_status = 'awaiting_reply'
            and c.accepted_at <= i.sent_at + interval '1 minute' and c.accepted_at > i.sent_at - interval '7 days'
        order by i.message_id, c.accepted_at desc
    )
    insert into public.automation_followups as f (
        id, user_id, account_id, automation_comment_id, ig_user_id, recipient_id, trigger_message_id, status,
        next_attempt_at, window_expires_at
    )
    select w.followup_id, w.user_id, w.account_id, w.comment_id, p_ig_user_id, w.recipient_id, w.message_id, 'queued',
        now() - interval '30 seconds', w.sent_at + interval '1 day'
    from waiting w
    order by w.sent_at
    on conflict do nothing
    returning f.id;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_followups_for_messages(text, jsonb) from public, anon, authenticated;
grant execute on function public.automation_followups_for_messages(text, jsonb) to service_role;
