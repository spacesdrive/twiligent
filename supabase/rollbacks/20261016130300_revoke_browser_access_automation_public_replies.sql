-- turns row level security off on automation_public_replies; it had no browser grants to give back
alter table if exists public.automation_public_replies disable row level security;
