-- removes all browser access to settings, because only the Worker should read it
drop policy if exists users_own_settings on public.settings;
revoke all on table public.settings from anon, authenticated;
