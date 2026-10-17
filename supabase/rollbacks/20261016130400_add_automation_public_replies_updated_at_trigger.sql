-- removes the trigger that keeps updated_at current on automation_public_replies
drop trigger if exists automation_public_replies_set_updated_at on public.automation_public_replies;
