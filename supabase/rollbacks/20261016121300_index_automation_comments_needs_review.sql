-- removes the index of replies that need review
drop index if exists public.automation_comments_needs_review_idx;
