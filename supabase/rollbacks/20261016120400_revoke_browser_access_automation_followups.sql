-- turns row level security off on automation_followups; it had no browser grants to give back
alter table public.automation_followups disable row level security;
