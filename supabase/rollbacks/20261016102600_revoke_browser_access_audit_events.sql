-- the table had no browser grants before, because new tables in public start without them
alter table public.audit_events disable row level security;
