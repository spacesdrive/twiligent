-- removes the public reply kind from automation_attempts, deleting public reply attempts first because the old table cannot hold them
delete from public.automation_attempts where kind = 'public_reply';
alter table public.automation_attempts
    drop constraint if exists automation_attempts_public_reply_check,
    drop constraint if exists automation_attempts_kind_check,
    drop column if exists public_reply_id,
    add constraint automation_attempts_kind_check check (kind in ('private_reply', 'followup'));
