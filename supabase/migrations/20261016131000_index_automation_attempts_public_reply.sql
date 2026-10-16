-- deleting a public reply removes its attempts, and the review reads them, without scanning every attempt
create index automation_attempts_public_reply_idx on public.automation_attempts (public_reply_id) where public_reply_id is not null;
