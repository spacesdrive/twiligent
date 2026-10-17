-- only allows Reddit posts and YouTube videos as tracked items, an account only on Reddit items, and a JSON object or nothing as data
alter table public.tracked_posts
    add constraint tracked_posts_content_type_check check (content_type in ('reddit', 'youtube')),
    -- only Reddit items read through an account, for its cookie
    add constraint tracked_posts_account_check check (content_type = 'reddit' or account_id is null),
    add constraint tracked_posts_data_check check (data is null or jsonb_typeof(data) = 'object');
