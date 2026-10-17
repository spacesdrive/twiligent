-- lets automation_attempts record public replies as their own kind
alter table public.automation_attempts
    add column public_reply_id text references public.automation_public_replies (id) on delete cascade,
    drop constraint automation_attempts_kind_check,
    add constraint automation_attempts_kind_check check (kind in ('private_reply', 'followup', 'public_reply')),
    add constraint automation_attempts_public_reply_check check ((kind = 'public_reply') = (public_reply_id is not null));
