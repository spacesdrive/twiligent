-- removes the index of public replies that need review
drop index if exists public.automation_public_replies_needs_review_idx;
