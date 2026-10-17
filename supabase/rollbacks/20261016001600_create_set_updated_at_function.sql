-- removes the set_updated_at function; roll back every updated_at trigger first
drop function if exists public.set_updated_at();
