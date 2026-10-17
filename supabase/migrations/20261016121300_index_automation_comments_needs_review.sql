-- adds an index that finds replies whose outcome is unknown
create index automation_comments_needs_review_idx on public.automation_comments (review_checked_at nulls first, updated_at) where status = 'needs_review';
