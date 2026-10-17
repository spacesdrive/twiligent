-- adds an index that finds follow-ups held by a run that stopped
create index automation_followups_claimed_idx on public.automation_followups (claimed_at) where status in ('processing', 'sending');
