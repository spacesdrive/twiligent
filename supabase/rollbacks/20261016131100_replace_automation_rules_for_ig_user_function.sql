-- puts back the earlier automation_rules_for_ig_user, without the public reply settings
drop function if exists public.automation_rules_for_ig_user(text);
-- the enabled rules of every connected account a webhook's Instagram account id belongs to, oldest account first
create or replace function public.automation_rules_for_ig_user(p_ig_user_id text)
returns table (
    id text,
    user_id uuid,
    account_id text,
    keywords text[],
    match_mode text,
    case_sensitive boolean,
    media_ids text[],
    created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
    select r.id, r.user_id, r.account_id, r.keywords, r.match_mode, r.case_sensitive, r.media_ids, r.created_at
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
