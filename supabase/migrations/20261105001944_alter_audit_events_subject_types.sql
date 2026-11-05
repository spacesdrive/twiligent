-- lets audit_events record changes made through Claude clients, publishing, media and YouTube
alter table public.audit_events
    drop constraint audit_events_subject_type_check,
    add constraint audit_events_subject_type_check check (subject_type in (
        'account', 'automation_rule', 'automation_account', 'automation_comment',
        'mcp_access_token', 'mcp_client', 'scheduled_post', 'tracked_post', 'media_asset',
        'youtube_connection', 'youtube_upload', 'settings'
    ));
