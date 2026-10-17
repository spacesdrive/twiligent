-- adds updated_at to settings with the trigger that keeps updated_at current
alter table public.settings add column if not exists updated_at timestamptz not null default now();

-- existing rows were last changed at an unknown time; their creation time is the closest honest value
update public.settings set updated_at = created_at;

create trigger settings_set_updated_at before update on public.settings
    for each row execute function public.set_updated_at();
