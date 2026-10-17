-- adds the followers-only wait and the review checks to automation_comments
alter table public.automation_comments
    -- the person Instagram says received the private reply, so their answer can be matched to this comment
    add column recipient_id text,
    -- followers-only rules: waiting for the person to reply, link sent, or no more reminders
    add column gate_status text,
    add column gate_prompts integer not null default 0,
    -- checks of a reply whose outcome was unknown against the conversation on Instagram
    add column review_checks integer not null default 0,
    add column review_checked_at timestamptz,
    add constraint automation_comments_gate_status_check check (gate_status is null or gate_status in ('awaiting_reply', 'completed', 'closed')),
    add constraint automation_comments_gate_prompts_check check (gate_prompts >= 0),
    add constraint automation_comments_review_checks_check check (review_checks >= 0);
