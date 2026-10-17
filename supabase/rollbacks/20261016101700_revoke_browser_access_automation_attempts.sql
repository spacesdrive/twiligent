-- turns row level security off on automation_attempts; it had no browser grants to give back
alter table public.automation_attempts disable row level security;
