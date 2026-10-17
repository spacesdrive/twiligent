-- makes a scheduled post point at an account of the same user, and removes the post with that account
alter table public.scheduled_posts drop constraint if exists scheduled_posts_account_id_fkey;
alter table public.scheduled_posts
    add constraint scheduled_posts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade;
