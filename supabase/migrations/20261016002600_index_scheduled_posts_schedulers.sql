-- adds indexes that let the schedulers find due and stuck posts without reading published ones
drop index if exists public.scheduled_posts_due_idx;
create index scheduled_posts_due_idx on public.scheduled_posts (scheduled_at) where status = 'pending';
create index if not exists scheduled_posts_claimed_idx on public.scheduled_posts (claimed_at) where status = 'publishing';
