-- reserve_automation_public_reply: the public replies one person already got, or may have got, on one post
create index automation_public_replies_recipient_idx on public.automation_public_replies (account_id, from_id, media_id, created_at)
    where status in ('sending', 'accepted', 'needs_review');
