-- adds an index that lists a person's media newest first
create index media_assets_user_created_idx on public.media_assets (user_id, created_at desc);
