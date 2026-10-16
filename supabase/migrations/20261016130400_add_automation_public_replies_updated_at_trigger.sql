-- set_updated_at() keeps updated_at, so no query has to set it
create trigger automation_public_replies_set_updated_at before update on public.automation_public_replies
    for each row execute function public.set_updated_at();
