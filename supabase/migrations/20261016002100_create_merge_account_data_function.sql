-- creates merge_account_data, which merges changes into an account in one step so two writers never undo each other
create or replace function public.merge_account_data(p_id text, p_user_id uuid, p_patch jsonb)
returns boolean
language sql
set search_path = ''
as $$
    update public.accounts
    set data = data || p_patch
    where id = p_id and (p_user_id is null or user_id = p_user_id)
    returning true;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.merge_account_data(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_account_data(text, uuid, jsonb) to service_role;
