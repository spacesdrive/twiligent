-- removes media_assets; the files stay on Cloudinary, only Twiligent's record of who owns them goes
drop table if exists public.media_assets;
