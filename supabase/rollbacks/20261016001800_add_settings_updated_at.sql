drop trigger if exists settings_set_updated_at on public.settings;
alter table public.settings drop column if exists updated_at;
