-- creates reserve_youtube_quota, which takes units from a day's bucket only while they fit under its limit
create or replace function public.reserve_youtube_quota(p_day date, p_bucket text, p_units integer, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
    reserved integer;
begin
    insert into public.youtube_quota_usage as q (day, bucket, units)
    values (p_day, p_bucket, p_units)
    on conflict (day, bucket) do update set units = q.units + excluded.units
        where q.units + excluded.units <= p_limit
    returning q.units into reserved;
    -- a first row over the limit is still inserted by the plain insert, so it is checked here too
    if reserved is null or reserved > p_limit then
        if reserved is not null then
            update public.youtube_quota_usage set units = units - p_units where day = p_day and bucket = p_bucket;
        end if;
        return false;
    end if;
    return true;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.reserve_youtube_quota(date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_youtube_quota(date, text, integer, integer) to service_role;
