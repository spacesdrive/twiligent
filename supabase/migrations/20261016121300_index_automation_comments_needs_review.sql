-- automation_review_candidates and the queue health: replies a person may need to check, without scanning the history
create index automation_comments_needs_review_idx on public.automation_comments (review_checked_at nulls first, updated_at) where status = 'needs_review';
