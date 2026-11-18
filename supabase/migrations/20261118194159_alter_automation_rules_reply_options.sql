-- adds the option to send the link only after the person replies, and other wordings of the first message, to automation_rules
alter table public.automation_rules
    add column link_after_reply boolean not null default false,
    add column reply_variants text[] not null default '{}',
    add constraint automation_rules_reply_variants_check check (cardinality(reply_variants) <= 4);
