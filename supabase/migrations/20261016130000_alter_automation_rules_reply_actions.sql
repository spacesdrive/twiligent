-- a rule answers a matching comment with a private reply, a public reply under the comment, or both; existing rules
-- keep the private reply alone. A public reply rotates between up to five texts, so a busy post does not fill with
-- the same words
alter table public.automation_rules
    drop constraint automation_rules_reply_text_check,
    add column private_reply_enabled boolean not null default true,
    add column public_reply_enabled boolean not null default false,
    add column public_reply_texts text[] not null default '{}',
    -- a rule without the private reply keeps an empty reply text
    add constraint automation_rules_reply_text_check check (
        char_length(reply_text) between 1 and 1000 or (not private_reply_enabled and reply_text = '')
    ),
    add constraint automation_rules_actions_check check (private_reply_enabled or public_reply_enabled),
    add constraint automation_rules_public_reply_texts_check check (
        cardinality(public_reply_texts) <= 5 and (not public_reply_enabled or cardinality(public_reply_texts) >= 1)
    ),
    -- the followers-only wait starts with the private reply
    add constraint automation_rules_follow_private_check check (not require_follow or private_reply_enabled);
