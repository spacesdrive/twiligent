-- creates purge_automation_comments, which deletes old comments in small batches
create or replace function public.purge_automation_comments(p_before timestamptz, p_limit integer)
returns integer
language sql
set search_path = ''
as $$
    with doomed as (
        select c.id
        from public.automation_comments c
        where c.created_at < p_before
        order by c.created_at
        limit p_limit
        for update skip locked
    ),
    deleted as (
        delete from public.automation_comments c
        using doomed
        where c.id = doomed.id
        returning c.id
    )
    select count(*)::integer from deleted;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.purge_automation_comments(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.purge_automation_comments(timestamptz, integer) to service_role;
