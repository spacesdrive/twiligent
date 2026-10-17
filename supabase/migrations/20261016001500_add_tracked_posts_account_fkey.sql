-- makes a tracked item point at an account of the same user, and clears the account when it is removed
alter table public.tracked_posts drop constraint if exists tracked_posts_account_id_fkey;
alter table public.tracked_posts
    add constraint tracked_posts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete set null (account_id);
