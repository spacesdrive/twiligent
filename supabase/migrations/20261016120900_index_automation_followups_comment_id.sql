-- adds an index that finds the follow-ups of one comment
create index automation_followups_comment_id_idx on public.automation_followups (automation_comment_id, created_at);
