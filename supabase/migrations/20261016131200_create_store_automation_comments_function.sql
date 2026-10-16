-- stores a webhook's comments and the public replies their rules ask for in one transaction, so a comment is never
-- kept without its public reply. A notification Meta delivers again inserts nothing: comments are unique per account
-- and public replies per comment. Answers the new comments' ids and statuses and the new public replies' ids
create or replace function public.store_automation_comments(p_comments jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    stored jsonb;
    replies jsonb;
begin
    with inserted as (
        insert into public.automation_comments (
            id, user_id, account_id, rule_id, ig_user_id, comment_id, media_id, from_id, from_username, text, status,
            status_reason, next_attempt_at, notified_at, expires_at
        )
        select x.id, x.user_id, x.account_id, x.rule_id, x.ig_user_id, x.comment_id, x.media_id, x.from_id, x.from_username,
            x.text, x.status, x.status_reason, x.next_attempt_at, x.notified_at, x.expires_at
        from jsonb_to_recordset(p_comments) as x(
            id text, user_id uuid, account_id text, rule_id text, ig_user_id text, comment_id text, media_id text,
            from_id text, from_username text, text text, status text, status_reason text, next_attempt_at timestamptz,
            notified_at timestamptz, expires_at timestamptz
        )
        on conflict (ig_user_id, comment_id) do nothing
        returning automation_comments.id, automation_comments.status
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', inserted.id, 'status', inserted.status)), '[]'::jsonb) into stored from inserted;

    -- joined to the comment as stored, new or kept from an earlier copy, and only while the same rule answers it
    with inserted as (
        insert into public.automation_public_replies (
            id, user_id, account_id, automation_comment_id, rule_id, ig_user_id, comment_id, media_id, from_id, reply_text,
            status, next_attempt_at, expires_at
        )
        select x.public_reply_id, c.user_id, c.account_id, c.id, c.rule_id, c.ig_user_id, c.comment_id, c.media_id, c.from_id,
            x.public_reply_text, 'queued', now(), c.expires_at
        from jsonb_to_recordset(p_comments) as x(
            ig_user_id text, comment_id text, rule_id text, public_reply_id text, public_reply_text text
        )
        join public.automation_comments c on c.ig_user_id = x.ig_user_id and c.comment_id = x.comment_id and c.rule_id = x.rule_id
        where x.public_reply_id is not null and x.public_reply_text is not null
        on conflict (automation_comment_id) do nothing
        returning automation_public_replies.id
    )
    select coalesce(jsonb_agg(inserted.id), '[]'::jsonb) into replies from inserted;

    return jsonb_build_object('comments', stored, 'public_replies', replies);
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.store_automation_comments(jsonb) from public, anon, authenticated;
grant execute on function public.store_automation_comments(jsonb) to service_role;
