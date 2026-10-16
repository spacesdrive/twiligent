-- the table had no browser grants before, because new tables in public start without them
alter table public.automation_comments disable row level security;
