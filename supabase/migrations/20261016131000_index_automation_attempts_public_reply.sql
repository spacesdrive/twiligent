-- adds an index that finds the attempts of one public reply
create index automation_attempts_public_reply_idx on public.automation_attempts (public_reply_id) where public_reply_id is not null;
