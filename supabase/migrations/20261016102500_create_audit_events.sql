-- creates audit_events, which records who connected, removed or changed what
create table public.audit_events (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    action text not null,
    subject_type text not null,
    subject_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint audit_events_action_check check (action ~ '^[a-z_]+\.[a-z_]+$'),
    constraint audit_events_subject_type_check check (subject_type in ('account', 'automation_rule', 'automation_account', 'automation_comment')),
    constraint audit_events_details_check check (jsonb_typeof(details) = 'object')
);
