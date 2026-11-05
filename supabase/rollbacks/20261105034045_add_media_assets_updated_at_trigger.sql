-- removes the trigger that keeps updated_at current on media_assets
drop trigger if exists media_assets_set_updated_at on public.media_assets;
