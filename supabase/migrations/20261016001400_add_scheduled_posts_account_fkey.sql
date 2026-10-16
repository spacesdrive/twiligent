-- a scheduled post can only name an account of the same user, and goes with that account when it is removed
alter table public.scheduled_posts drop constraint if exists scheduled_posts_account_id_fkey;
alter table public.scheduled_posts
    add constraint scheduled_posts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade;
