-- deploy the code that reads data before writing it again first, or its writes will fail
drop function if exists public.merge_tracked_post_data(text, uuid, jsonb);
