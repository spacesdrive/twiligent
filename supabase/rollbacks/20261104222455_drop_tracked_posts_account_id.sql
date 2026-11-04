-- adds tracked_posts.account_id back, empty, with its link to the account it names
alter table public.tracked_posts add column account_id text;
alter table public.tracked_posts
    add constraint tracked_posts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete set null (account_id);
