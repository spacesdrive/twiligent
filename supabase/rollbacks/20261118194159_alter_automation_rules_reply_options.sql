-- removes the link-after-reply option and the other wordings from automation_rules
alter table public.automation_rules
    drop constraint if exists automation_rules_reply_variants_check,
    drop column if exists reply_variants,
    drop column if exists link_after_reply;
