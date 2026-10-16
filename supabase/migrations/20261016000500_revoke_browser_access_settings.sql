-- only the Worker's service role reads settings; the anon key ships in every browser, so browser roles get nothing
drop policy if exists users_own_settings on public.settings;
revoke all on table public.settings from anon, authenticated;
