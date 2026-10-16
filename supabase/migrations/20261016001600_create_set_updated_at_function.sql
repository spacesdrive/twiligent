-- one trigger function keeps updated_at on every table, so no query has to remember to set it
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
