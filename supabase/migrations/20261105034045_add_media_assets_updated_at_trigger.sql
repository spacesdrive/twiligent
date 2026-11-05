-- adds the trigger that keeps updated_at current on media_assets
create trigger media_assets_set_updated_at before update on public.media_assets
    for each row execute function public.set_updated_at();
