-- the table had no browser grants before, because new tables in public start without them
alter table public.automation_followups disable row level security;
