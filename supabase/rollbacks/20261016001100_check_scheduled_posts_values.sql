alter table public.scheduled_posts
    drop constraint if exists scheduled_posts_data_check,
    drop constraint if exists scheduled_posts_claim_check,
    drop constraint if exists scheduled_posts_attempts_check,
    drop constraint if exists scheduled_posts_status_check;
