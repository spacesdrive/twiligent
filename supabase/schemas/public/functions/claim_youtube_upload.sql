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

GRANT EXECUTE ON FUNCTION "public"."claim_youtube_upload"(text, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."claim_youtube_upload"(text, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_youtube_upload"(text, integer) TO "postgres";

REVOKE ALL ON FUNCTION "public"."claim_youtube_upload"(text, integer) FROM PUBLIC, "anon", "authenticated";
