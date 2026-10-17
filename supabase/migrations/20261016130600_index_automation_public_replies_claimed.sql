-- adds an index that finds public replies held by a run that stopped
create index automation_public_replies_claimed_idx on public.automation_public_replies (claimed_at) where status in ('processing', 'sending');
