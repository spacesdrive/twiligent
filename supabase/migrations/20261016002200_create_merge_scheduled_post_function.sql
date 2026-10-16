-- one UPDATE for status, time and a data patch; p_only_status keeps an edit off a post a scheduler has just claimed
create or replace function public.merge_scheduled_post(
    p_id text,
    p_user_id uuid,
    p_patch jsonb,
    p_status text default null,
    p_scheduled_at timestamptz default null,
    p_only_status text default null
)
returns boolean
language sql
set search_path = ''
as $$
    update public.scheduled_posts
    set data = data || p_patch,
        status = coalesce(p_status, status),
        scheduled_at = coalesce(p_scheduled_at, scheduled_at)
    where id = p_id
        and (p_user_id is null or user_id = p_user_id)
        and (p_only_status is null or status = p_only_status)
    returning true;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.merge_scheduled_post(text, uuid, jsonb, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.merge_scheduled_post(text, uuid, jsonb, text, timestamptz, text) to service_role;
