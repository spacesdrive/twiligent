-- claim_automation_comments: jobs that are due, oldest first; partial, so the history is left out
create index automation_comments_due_idx on public.automation_comments (next_attempt_at) where status in ('queued', 'retry_wait');
