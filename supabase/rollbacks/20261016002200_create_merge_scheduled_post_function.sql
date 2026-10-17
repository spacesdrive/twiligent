-- removes merge_scheduled_post; deploy code that no longer calls it first
drop function if exists public.merge_scheduled_post(text, uuid, jsonb, text, timestamptz, text);
