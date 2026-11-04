-- removes tracked Reddit posts and lets tracked_posts hold YouTube videos only
delete from public.tracked_posts where content_type = 'reddit';
alter table public.tracked_posts
    drop constraint tracked_posts_account_check,
    drop constraint tracked_posts_content_type_check,
    add constraint tracked_posts_content_type_check check (content_type = 'youtube'),
    alter column content_type set default 'youtube';
