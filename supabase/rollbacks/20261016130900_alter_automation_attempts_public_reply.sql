-- public reply attempts have no place in the old table, so they are removed first
delete from public.automation_attempts where kind = 'public_reply';
alter table public.automation_attempts
    drop constraint if exists automation_attempts_public_reply_check,
    drop constraint if exists automation_attempts_kind_check,
    drop column if exists public_reply_id,
    add constraint automation_attempts_kind_check check (kind in ('private_reply', 'followup'));
