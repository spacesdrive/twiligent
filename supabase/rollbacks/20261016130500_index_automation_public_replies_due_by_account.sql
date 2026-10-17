-- removes the index of public replies waiting to be posted
drop index if exists public.automation_public_replies_due_account_idx;
