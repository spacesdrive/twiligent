-- claim_automation_comments: jobs whose run stopped holding them
create index automation_comments_claimed_idx on public.automation_comments (claimed_at) where status in ('processing', 'sending');
