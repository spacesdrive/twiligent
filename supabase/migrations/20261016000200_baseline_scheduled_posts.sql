-- the scheduled_posts table before versioned migrations; safe to repeat on a database that already has it
create table if not exists public.scheduled_posts (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    status text not null default 'pending',
    scheduled_at timestamptz not null,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    claimed_at timestamptz,
    attempts integer not null default 0
);

-- older setup SQL had no created_at, no claim columns and allowed null data
alter table public.scheduled_posts
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists claimed_at timestamptz,
    add column if not exists attempts integer not null default 0;
update public.scheduled_posts set data = '{}'::jsonb where data is null;
alter table public.scheduled_posts alter column data set default '{}'::jsonb, alter column data set not null;

-- posts stuck in publishing before the claim lease have no saved container, so nothing can tell whether they went out
update public.scheduled_posts
set status = 'failed',
    data = data || jsonb_build_object('error', 'Publishing was interrupted before Twiligent tracked it. Check Instagram before scheduling this post again.')
where status = 'publishing' and claimed_at is null;

create index if not exists scheduled_posts_user_id_idx on public.scheduled_posts (user_id);
create index if not exists scheduled_posts_due_idx on public.scheduled_posts (status, scheduled_at);

alter table public.scheduled_posts enable row level security;
