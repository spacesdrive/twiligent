-- removes the index of public replies by person and post
drop index if exists public.automation_public_replies_recipient_idx;
