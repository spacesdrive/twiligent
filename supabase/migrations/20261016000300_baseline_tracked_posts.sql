-- the tracked_posts table before versioned migrations; safe to repeat on a database that already has it
create table if not exists public.tracked_posts (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text references public.accounts (id) on delete set null,
    url text not null,
    label text not null default '',
    category text not null default '',
    content_type text not null default 'reddit',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    data jsonb
);

-- the first version of the table had no content_type
alter table public.tracked_posts add column if not exists content_type text not null default 'reddit';

create index if not exists tracked_posts_user_id_idx on public.tracked_posts (user_id);

alter table public.tracked_posts enable row level security;
