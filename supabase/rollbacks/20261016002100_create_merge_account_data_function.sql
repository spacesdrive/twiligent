-- removes merge_account_data; deploy code that no longer calls it first
drop function if exists public.merge_account_data(text, uuid, jsonb);
