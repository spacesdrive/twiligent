-- a rule without the private reply has no place in the old shape, so such rules are removed first
delete from public.automation_rules where not private_reply_enabled;
alter table public.automation_rules
    drop constraint if exists automation_rules_follow_private_check,
    drop constraint if exists automation_rules_public_reply_texts_check,
    drop constraint if exists automation_rules_actions_check,
    drop constraint if exists automation_rules_reply_text_check,
    drop column if exists public_reply_texts,
    drop column if exists public_reply_enabled,
    drop column if exists private_reply_enabled,
    add constraint automation_rules_reply_text_check check (char_length(reply_text) between 1 and 1000);
