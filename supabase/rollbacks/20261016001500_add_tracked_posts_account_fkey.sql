alter table public.tracked_posts drop constraint if exists tracked_posts_account_fkey;
alter table public.tracked_posts
    add constraint tracked_posts_account_id_fkey foreign key (account_id)
        references public.accounts (id) on delete set null;
