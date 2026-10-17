-- creates automation_rules, which holds the rules that answer Instagram comments
create table public.automation_rules (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    name text not null,
    keywords text[] not null,
    match_mode text not null default 'contains',
    case_sensitive boolean not null default false,
    -- empty means every post and reel of the account
    media_ids text[] not null default '{}',
    reply_text text not null,
    link_url text,
    enabled boolean not null default false,
    hourly_limit integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_rules_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint automation_rules_name_check check (char_length(name) between 1 and 80),
    constraint automation_rules_keywords_check check (cardinality(keywords) between 1 and 10),
    constraint automation_rules_match_mode_check check (match_mode in ('contains', 'exact')),
    constraint automation_rules_media_ids_check check (cardinality(media_ids) <= 50),
    constraint automation_rules_reply_text_check check (char_length(reply_text) between 1 and 1000),
    constraint automation_rules_link_url_check check (link_url is null or link_url ~ '^https://'),
    -- Instagram allows 750 private replies an hour per account for posts and reels
    constraint automation_rules_hourly_limit_check check (hourly_limit is null or hourly_limit between 1 and 750)
);
