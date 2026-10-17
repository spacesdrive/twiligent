-- creates the settings table as it was before migrations, and is safe to run again on a database that has it
create table if not exists public.settings (
    user_id uuid not null references auth.users (id) on delete cascade,
    key text not null,
    value jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    primary key (user_id, key)
);

-- older setup SQL had no created_at and allowed a null value
alter table public.settings add column if not exists created_at timestamptz not null default now();
update public.settings set value = '{}'::jsonb where value is null;
alter table public.settings alter column value set default '{}'::jsonb, alter column value set not null;

alter table public.settings enable row level security;
