-- claim_automation_public_replies: public replies whose run stopped holding them
create index automation_public_replies_claimed_idx on public.automation_public_replies (claimed_at) where status in ('processing', 'sending');
