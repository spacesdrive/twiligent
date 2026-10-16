-- a tracked item can only read through the same user's account; removing the account keeps the item without one
alter table public.tracked_posts drop constraint if exists tracked_posts_account_id_fkey;
alter table public.tracked_posts
    add constraint tracked_posts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete set null (account_id);
