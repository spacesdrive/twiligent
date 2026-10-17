-- removes automation_followups_for_messages
drop function if exists public.automation_followups_for_messages(text, jsonb);
