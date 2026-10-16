-- Supabase grants new tables and functions in public to the browser roles; later migrations start without that
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
