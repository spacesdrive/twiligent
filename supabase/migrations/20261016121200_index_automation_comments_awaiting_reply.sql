-- adds an index that finds the followers-only replies waiting for a person's answer
create index automation_comments_awaiting_reply_idx on public.automation_comments (ig_user_id, recipient_id, accepted_at) where gate_status = 'awaiting_reply';
