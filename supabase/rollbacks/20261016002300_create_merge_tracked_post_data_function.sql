-- removes merge_tracked_post_data; deploy code that no longer calls it first
drop function if exists public.merge_tracked_post_data(text, uuid, jsonb);
