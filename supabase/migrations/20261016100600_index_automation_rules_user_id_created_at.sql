-- automationRules.listForUser: where user_id = $1 order by created_at, id
create index automation_rules_user_id_created_at_idx on public.automation_rules (user_id, created_at, id);
