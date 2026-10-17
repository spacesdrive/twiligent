CREATE OR REPLACE FUNCTION public.automation_rules_for_ig_user (
  p_ig_user_id text
)
  RETURNS TABLE (
    id                    text,
    user_id               uuid,
    account_id            text,
    keywords              text[],
    match_mode            text,
    case_sensitive        boolean,
    media_ids             text[],
    created_at            timestamp with time zone,
    private_reply_enabled boolean,
    public_reply_enabled  boolean,
    public_reply_texts    text[]
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
    select r.id, r.user_id, r.account_id, r.keywords, r.match_mode, r.case_sensitive, r.media_ids, r.created_at,
        r.private_reply_enabled, r.public_reply_enabled, r.public_reply_texts
    from public.accounts a
    join public.automation_rules r on r.account_id = a.id and r.user_id = a.user_id
    where a.platform = 'instagram'
        and a.data ->> 'igUserId' = p_ig_user_id
        and r.enabled
    order by a.created_at, a.id, r.created_at, r.id;
$function$;

GRANT EXECUTE ON FUNCTION "public"."automation_rules_for_ig_user"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."automation_rules_for_ig_user"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."automation_rules_for_ig_user"(text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."automation_rules_for_ig_user"(text) FROM PUBLIC, "anon", "authenticated";
