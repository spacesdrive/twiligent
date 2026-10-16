alter table public.tracked_posts
    drop constraint if exists tracked_posts_data_check,
    drop constraint if exists tracked_posts_account_check,
    drop constraint if exists tracked_posts_content_type_check;
