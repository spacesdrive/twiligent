-- the four statuses of the publishing lifecycle; anything else is a bug and fails at the write
alter table public.scheduled_posts
    add constraint scheduled_posts_status_check check (status in ('pending', 'publishing', 'published', 'failed')),
    add constraint scheduled_posts_attempts_check check (attempts >= 0),
    -- the lease is measured from the claim, so a post being published must carry one
    add constraint scheduled_posts_claim_check check (status <> 'publishing' or claimed_at is not null),
    add constraint scheduled_posts_data_check check (jsonb_typeof(data) = 'object');
