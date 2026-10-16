-- one open follow-up per comment, so several messages from one person get one answer
create unique index automation_followups_open_comment_key on public.automation_followups (automation_comment_id)
    where status in ('queued', 'processing', 'retry_wait', 'sending');
