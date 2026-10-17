-- removes the any-comment and followers-only rule options, deleting any-comment rules first because the old checks refuse them
delete from public.automation_rules where match_mode = 'any';
alter table public.automation_rules
    drop constraint if exists automation_rules_follow_texts_check,
    drop constraint if exists automation_rules_not_following_text_check,
    drop constraint if exists automation_rules_follow_prompt_text_check,
    drop constraint if exists automation_rules_keywords_check,
    drop constraint if exists automation_rules_match_mode_check,
    drop column if exists not_following_text,
    drop column if exists follow_prompt_text,
    drop column if exists require_follow,
    add constraint automation_rules_keywords_check check (cardinality(keywords) between 1 and 10),
    add constraint automation_rules_match_mode_check check (match_mode in ('contains', 'exact'));
