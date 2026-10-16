-- deleting a comment removes its follow-ups, and the activity list shows the latest one
create index automation_followups_comment_id_idx on public.automation_followups (automation_comment_id, created_at);
