alter table public.automation_attempts
    -- private replies count against Instagram's 750 an hour per account; follow-ups go through the Send API instead
    add column kind text not null default 'private_reply',
    -- sha-256 of the text sent, so a reply whose answer was lost can be recognised in the conversation later
    add column message_digest text,
    add column followup_id text references public.automation_followups (id) on delete cascade,
    add constraint automation_attempts_kind_check check (kind in ('private_reply', 'followup')),
    add constraint automation_attempts_followup_check check ((kind = 'followup') = (followup_id is not null));
