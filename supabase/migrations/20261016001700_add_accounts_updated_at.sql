alter table public.accounts add column if not exists updated_at timestamptz not null default now();

-- existing rows were last changed at an unknown time; their creation time is the closest honest value
update public.accounts set updated_at = created_at;

create trigger accounts_set_updated_at before update on public.accounts
    for each row execute function public.set_updated_at();
