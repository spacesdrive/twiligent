-- the table had no browser grants before, because new tables in public start without them
alter table public.automation_rules disable row level security;
