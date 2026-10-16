-- who connected, removed or changed what; rows outlive the account they describe, and go with the user
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

-- only the Worker's service role reads the table; the anon key ships in every browser
alter table public.audit_events enable row level security;
revoke all on table public.audit_events from anon, authenticated;

create trigger audit_events_set_updated_at before update on public.audit_events
    for each row execute function public.set_updated_at();

-- auditEvents.listForUser: where user_id = $1 order by created_at desc
create index audit_events_user_id_created_at_idx on public.audit_events (user_id, created_at desc);
-- the daily retention delete across all users
create index audit_events_created_at_idx on public.audit_events (created_at);
