-- adds the trigger that keeps updated_at current on tracked_posts, a job the code did before
create trigger tracked_posts_set_updated_at before update on public.tracked_posts
    for each row execute function public.set_updated_at();
