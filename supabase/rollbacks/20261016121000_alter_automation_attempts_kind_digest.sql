-- follow-up attempts have no place in the old table, so they are removed first
delete from public.automation_attempts where kind = 'followup';
alter table public.automation_attempts
    drop constraint if exists automation_attempts_followup_check,
    drop constraint if exists automation_attempts_kind_check,
    drop column if exists followup_id,
    drop column if exists message_digest,
    drop column if exists kind;
