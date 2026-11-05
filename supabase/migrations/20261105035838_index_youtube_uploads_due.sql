-- adds an index that finds the upload jobs a run may work on, oldest due first
create index youtube_uploads_due_idx on public.youtube_uploads (next_attempt_at)
    where state in ('queued', 'uploading', 'processing', 'finalizing', 'waiting_quota');
