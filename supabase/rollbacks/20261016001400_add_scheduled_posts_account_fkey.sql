-- production had no foreign key here before the migration
alter table public.scheduled_posts drop constraint if exists scheduled_posts_account_fkey;
