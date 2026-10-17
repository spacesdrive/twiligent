-- adds the trigger that keeps updated_at current on automation_public_replies
create trigger automation_public_replies_set_updated_at before update on public.automation_public_replies
    for each row execute function public.set_updated_at();
