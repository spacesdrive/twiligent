-- creates youtube_uploads, one job per video that the scheduled runs upload to YouTube in resumable chunks
create table public.youtube_uploads (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    connection_id text not null references public.youtube_connections (id) on delete cascade,
    -- the source on the instance's Cloudinary account, read in byte ranges
    source_url text not null,
    source_bytes bigint not null,
    content_type text not null,
    thumbnail_url text,
    is_short boolean not null default false,
    -- a snapshot of what the person asked for; editing is only possible before the upload starts
    title text not null,
    description text not null default '',
    tags text[] not null default '{}',
    category_id text not null default '22',
    privacy text not null,
    publish_at timestamptz,
    made_for_kids boolean not null default false,
    synthetic_media boolean not null default false,
    notify_subscribers boolean not null default true,
    state text not null default 'queued',
    -- saved before any bytes are sent, so a lost answer never starts a second upload of the same video
    session_uri text,
    bytes_confirmed bigint not null default 0,
    video_id text,
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    lease_owner text,
    lease_until timestamptz,
    last_error text,
    client_request_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint youtube_uploads_user_request_key unique (user_id, client_request_id),
    constraint youtube_uploads_state_check check (state in ('queued', 'uploading', 'processing', 'finalizing', 'done', 'waiting_quota', 'needs_reconnect', 'needs_review', 'failed', 'cancelled')),
    constraint youtube_uploads_privacy_check check (privacy in ('private', 'unlisted', 'public')),
    constraint youtube_uploads_title_check check (char_length(title) between 1 and 100),
    constraint youtube_uploads_source_url_check check (source_url ~ '^https://'),
    constraint youtube_uploads_source_bytes_check check (source_bytes > 0),
    constraint youtube_uploads_bytes_confirmed_check check (bytes_confirmed between 0 and source_bytes),
    -- YouTube only schedules private videos
    constraint youtube_uploads_publish_at_check check (publish_at is null or privacy = 'private')
);
