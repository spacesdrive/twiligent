-- removes the index that counts replies to one person
drop index if exists public.automation_attempts_recipient_idx;
