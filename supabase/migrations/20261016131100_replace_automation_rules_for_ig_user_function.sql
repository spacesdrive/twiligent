-- the enabled rules of every connected account a webhook's Instagram account id belongs to, oldest account first,
-- with what each one answers with: the private reply, the public reply and its texts. The return only gains
-- columns, so the Worker deployed before this change reads the ones it knows
drop function if exists public.automation_rules_for_ig_user(text);
create or replace function public.automation_rules_for_ig_user(p_ig_user_id text)
returns table (
    id text,
    user_id uuid,
    account_id text,
    keywords text[],
    match_mode text,
    case_sensitive boolean,
    media_ids text[],
    created_at timestamptz,
    private_reply_enabled boolean,
    public_reply_enabled boolean,
    public_reply_texts text[]
)
language sql
stable
set search_path = ''
as $$
    select r.id, r.user_id, r.account_id, r.keywords, r.match_mode, r.case_sensitive, r.media_ids, r.created_at,
        r.private_reply_enabled, r.public_reply_enabled, r.public_reply_texts
    from public.accounts a
    join public.automation_rules r on r.account_id = a.id and r.user_id = a.user_id
    where a.platform = 'instagram'
        and a.data ->> 'igUserId' = p_ig_user_id
        and r.enabled
    order by a.created_at, a.id, r.created_at, r.id;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_rules_for_ig_user(text) from public, anon, authenticated;
grant execute on function public.automation_rules_for_ig_user(text) to service_role;
