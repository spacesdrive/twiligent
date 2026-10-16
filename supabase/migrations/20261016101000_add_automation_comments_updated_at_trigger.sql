-- set_updated_at() keeps updated_at, so no query has to set it
create trigger automation_comments_set_updated_at before update on public.automation_comments
    for each row execute function public.set_updated_at();
