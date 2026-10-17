-- turns row level security off on automation_comments; it had no browser grants to give back
alter table public.automation_comments disable row level security;
