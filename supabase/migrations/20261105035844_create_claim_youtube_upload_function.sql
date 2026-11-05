-- creates claim_youtube_upload, which leases one due upload job to a run so no two runs work on the same video
create or replace function public.claim_youtube_upload(p_owner text, p_lease_seconds integer)
returns setof public.youtube_uploads
language plpgsql
set search_path = ''
as $$
begin
    return query
    update public.youtube_uploads u
    set lease_owner = p_owner, lease_until = now() + make_interval(secs => p_lease_seconds)
    where u.id = (
        select j.id from public.youtube_uploads j
        where j.state in ('queued', 'uploading', 'processing', 'finalizing', 'waiting_quota')
            and j.next_attempt_at <= now()
            and (j.lease_until is null or j.lease_until < now())
        order by j.next_attempt_at, j.id
        limit 1
        for update skip locked
    )
    returning u.*;
end;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.claim_youtube_upload(text, integer) from public, anon, authenticated;
grant execute on function public.claim_youtube_upload(text, integer) to service_role;
