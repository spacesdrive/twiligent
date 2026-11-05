-- replaces automation_rules_for_ig_user so comments go only to accounts that still hold an unexpired Instagram token
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
        -- a member whose access ended (token removed or expired) no longer receives the account's comments
        and coalesce(a.data ->> 'accessToken', '') <> ''
        and (a.data ->> 'tokenExpiresAt' is null or (a.data ->> 'tokenExpiresAt')::timestamptz > now())
    order by a.created_at, a.id, r.created_at, r.id;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.automation_rules_for_ig_user(text) from public, anon, authenticated;
grant execute on function public.automation_rules_for_ig_user(text) to service_role;
