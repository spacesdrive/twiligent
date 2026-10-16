-- finish_automation_send and the claim close the attempts of one comment; the cascade from a comment
create index automation_attempts_comment_idx on public.automation_attempts (automation_comment_id);
