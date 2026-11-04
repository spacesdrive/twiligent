-- lets tracked_posts hold Reddit posts again; the deleted rows come back only from the backup taken before the change
alter table public.tracked_posts
    alter column content_type set default 'reddit',
    drop constraint tracked_posts_content_type_check,
    add constraint tracked_posts_content_type_check check (content_type in ('reddit', 'youtube')),
    add constraint tracked_posts_account_check check (content_type = 'reddit' or account_id is null);
