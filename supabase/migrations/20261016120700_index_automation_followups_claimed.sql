-- claim_automation_followups: follow-ups whose run stopped holding them
create index automation_followups_claimed_idx on public.automation_followups (claimed_at) where status in ('processing', 'sending');
