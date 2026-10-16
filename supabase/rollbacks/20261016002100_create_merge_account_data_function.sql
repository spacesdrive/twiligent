-- deploy the code that reads data before writing it again first, or its writes will fail
drop function if exists public.merge_account_data(text, uuid, jsonb);
