-- adds an index that finds the comments of one rule
create index automation_comments_rule_id_idx on public.automation_comments (rule_id) where rule_id is not null;
