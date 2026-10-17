-- puts back the older scheduler index on scheduled_posts
drop index if exists public.scheduled_posts_claimed_idx;
drop index if exists public.scheduled_posts_due_idx;
create index scheduled_posts_due_idx on public.scheduled_posts (status, scheduled_at);
