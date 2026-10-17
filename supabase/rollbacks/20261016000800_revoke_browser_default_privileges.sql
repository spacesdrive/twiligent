-- lets new tables and functions give the browser roles access by default again
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
