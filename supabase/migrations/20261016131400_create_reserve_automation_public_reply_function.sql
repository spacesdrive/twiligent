-- decides whether a claimed public reply may go out now and, when it may, records the attempt before the request
-- leaves; answers ok, gone, paused, cooldown, recipient_limit or account_limit. Only public reply attempts count, and
-- a full account is marked until a reply frees up so runs stop claiming its public replies
create or replace function public.reserve_automation_public_reply(
    p_id text,
    p_attempt_id text,
    p_account_limit integer,
    p_message_digest text default null
)
returns table (outcome text, retry_at timestamptz)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
    job public.automation_public_replies%rowtype;
    controls public.automation_accounts%rowtype;
    free_at timestamptz;
begin
    -- one public reservation at a time across every Worker; private replies take another lock, so neither waits on the other
    perform pg_advisory_xact_lock(hashtext('reserve_automation_public_reply'));

    select * into job from public.automation_public_replies p where p.id = p_id and p.status = 'processing' for update;
    if not found then
        return query select 'gone'::text, null::timestamptz;
        return;
    end if;

    select * into controls from public.automation_accounts a where a.account_id = job.account_id;
    if controls.paused then
        return query select 'paused'::text, null::timestamptz;
        return;
    end if;
    if controls.public_cooldown_until > now() then
        return query select 'cooldown'::text, controls.public_cooldown_until;
        return;
    end if;

    -- one public reply per person and post a day, however often they comment; it also ends a loop with another
    -- account's automation answering every reply
    if job.from_id is not null and exists (
        select 1 from public.automation_public_replies p
        where p.account_id = job.account_id and p.from_id = job.from_id and p.media_id is not distinct from job.media_id
            and p.id <> job.id and p.status in ('sending', 'accepted', 'needs_review') and p.created_at > now() - interval '1 day'
    ) then
        return query select 'recipient_limit'::text, null::timestamptz;
        return;
    end if;

    -- when the account is full, a reply frees up an hour after the oldest one in the window
    select case when count(*) >= p_account_limit then min(t.started_at) + interval '1 hour' end into free_at
    from public.automation_attempts t
    where t.account_id = job.account_id and t.kind = 'public_reply' and t.started_at > now() - interval '1 hour';
    if free_at is not null then
        insert into public.automation_accounts (account_id, user_id, public_limited_until)
        values (job.account_id, job.user_id, free_at)
        on conflict (account_id) do update set public_limited_until = excluded.public_limited_until;
        return query select 'account_limit'::text, free_at;
        return;
    end if;

    update public.automation_public_replies p
    set status = 'sending', claimed_at = now(), attempts = p.attempts + 1
    where p.id = p_id;
    insert into public.automation_attempts (id, user_id, account_id, automation_comment_id, rule_id, recipient_id, kind, public_reply_id, message_digest)
    values (p_attempt_id, job.user_id, job.account_id, job.automation_comment_id, job.rule_id, job.from_id, 'public_reply', job.id, p_message_digest);
    return query select 'ok'::text, null::timestamptz;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.reserve_automation_public_reply(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_automation_public_reply(text, text, integer, text) to service_role;
