-- automation_followups_for_messages: a sender's comments that wait for their reply; partial, so it stays small
create index automation_comments_awaiting_reply_idx on public.automation_comments (ig_user_id, recipient_id, accepted_at) where gate_status = 'awaiting_reply';
