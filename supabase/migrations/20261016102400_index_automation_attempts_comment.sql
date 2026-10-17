-- adds an index that finds the attempts of one comment
create index automation_attempts_comment_idx on public.automation_attempts (automation_comment_id);
