-- adds updated_at to scheduled_posts with the trigger that keeps updated_at current
alter table public.scheduled_posts add column if not exists updated_at timestamptz not null default now();

-- existing rows were last changed at an unknown time; their creation time is the closest honest value
update public.scheduled_posts set updated_at = created_at;

create trigger scheduled_posts_set_updated_at before update on public.scheduled_posts
    for each row execute function public.set_updated_at();
