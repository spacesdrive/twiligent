-- removes tracked_posts.account_id, which only named the Reddit account whose cookie read a post
alter table public.tracked_posts
    drop constraint tracked_posts_account_fkey,
    drop column account_id;
