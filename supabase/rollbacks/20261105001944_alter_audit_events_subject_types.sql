-- limits audit_events to the original four subject types; delete rows with the newer types first
alter table public.audit_events
    drop constraint audit_events_subject_type_check,
    add constraint audit_events_subject_type_check check (subject_type in (
        'account', 'automation_rule', 'automation_account', 'automation_comment'
    ));
