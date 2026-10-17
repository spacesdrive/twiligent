-- removes the foreign key from scheduled posts to their account, which production did not have before
alter table public.scheduled_posts drop constraint if exists scheduled_posts_account_fkey;
