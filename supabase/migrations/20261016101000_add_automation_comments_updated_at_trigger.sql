-- adds the trigger that keeps updated_at current on automation_comments
create trigger automation_comments_set_updated_at before update on public.automation_comments
    for each row execute function public.set_updated_at();
