-- creates the accounts table as it was before migrations, and is safe to run again on a database that has it
create table if not exists public.accounts (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    platform text not null,
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- older setup SQL had no created_at and allowed null data
alter table public.accounts add column if not exists created_at timestamptz not null default now();
update public.accounts set data = '{}'::jsonb where data is null;
alter table public.accounts alter column data set default '{}'::jsonb, alter column data set not null;

alter table public.accounts enable row level security;
