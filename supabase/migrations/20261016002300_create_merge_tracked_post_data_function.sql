-- merges a patch into data in one UPDATE, so a manual view count and a refresh at the same moment both survive
create or replace function public.merge_tracked_post_data(p_id text, p_user_id uuid, p_patch jsonb)
returns boolean
language sql
set search_path = ''
as $$
    update public.tracked_posts
    set data = coalesce(data, '{}'::jsonb) || p_patch
    where id = p_id and user_id = p_user_id
    returning true;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.merge_tracked_post_data(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_tracked_post_data(text, uuid, jsonb) to service_role;
