-- automationComments.listForUser and automation_stats: where user_id = $1 order by created_at desc
create index automation_comments_user_id_created_at_idx on public.automation_comments (user_id, created_at desc);
