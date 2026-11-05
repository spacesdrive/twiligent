-- creates media_assets, Twiligent's record of the images and videos each person keeps on the shared Cloudinary account
create table public.media_assets (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    -- Cloudinary's id for the file; the account is shared, so this row is what ties a file to one person
    public_id text not null,
    resource_type text not null,
    url text not null,
    format text,
    bytes bigint,
    width integer,
    height integer,
    duration_seconds numeric,
    label text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint media_assets_user_public_id_key unique (user_id, public_id),
    constraint media_assets_resource_type_check check (resource_type in ('image', 'video')),
    constraint media_assets_url_check check (url ~ '^https://'),
    constraint media_assets_label_check check (char_length(label) <= 200)
);
