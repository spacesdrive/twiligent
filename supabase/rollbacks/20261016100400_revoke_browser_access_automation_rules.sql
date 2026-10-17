-- turns row level security off on automation_rules; it had no browser grants to give back
alter table public.automation_rules disable row level security;
