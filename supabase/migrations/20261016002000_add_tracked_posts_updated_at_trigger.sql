-- tracked_posts already had updated_at, set by the repository; the trigger takes that job over
create trigger tracked_posts_set_updated_at before update on public.tracked_posts
    for each row execute function public.set_updated_at();
