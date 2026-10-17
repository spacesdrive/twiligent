-- creates the trigger function that sets updated_at on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
