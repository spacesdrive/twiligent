-- adds an index that checks whether a person already got a public reply on a post
create index automation_public_replies_recipient_idx on public.automation_public_replies (account_id, from_id, media_id, created_at)
    where status in ('sending', 'accepted', 'needs_review');
