-- adds an index that finds public replies whose outcome is unknown
create index automation_public_replies_needs_review_idx on public.automation_public_replies (review_checked_at nulls first, updated_at) where status = 'needs_review';
