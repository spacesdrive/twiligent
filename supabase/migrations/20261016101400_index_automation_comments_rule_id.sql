-- removing a rule clears rule_id on its comments, and stats filter by rule
create index automation_comments_rule_id_idx on public.automation_comments (rule_id) where rule_id is not null;
