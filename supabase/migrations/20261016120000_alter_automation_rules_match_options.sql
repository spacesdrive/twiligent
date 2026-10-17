-- adds rules that answer any comment and the followers-only option to automation_rules
alter table public.automation_rules
    drop constraint automation_rules_match_mode_check,
    drop constraint automation_rules_keywords_check,
    add column require_follow boolean not null default false,
    add column follow_prompt_text text,
    add column not_following_text text,
    add constraint automation_rules_match_mode_check check (match_mode in ('contains', 'exact', 'any')),
    -- an any-comment rule has no keywords; a keyword rule has 1 to 10
    add constraint automation_rules_keywords_check check (
        case when match_mode = 'any' then cardinality(keywords) = 0 else cardinality(keywords) between 1 and 10 end
    ),
    add constraint automation_rules_follow_prompt_text_check check (follow_prompt_text is null or char_length(follow_prompt_text) between 1 and 1000),
    add constraint automation_rules_not_following_text_check check (not_following_text is null or char_length(not_following_text) between 1 and 1000),
    add constraint automation_rules_follow_texts_check check (not require_follow or (follow_prompt_text is not null and not_following_text is not null));
