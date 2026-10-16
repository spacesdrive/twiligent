-- one row per private reply request sent to Instagram, which is what the sending limits count
create table public.automation_attempts (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    automation_comment_id text not null references public.automation_comments (id) on delete cascade,
    rule_id text references public.automation_rules (id) on delete set null,
    recipient_id text,
    outcome text not null default 'sending',
    error_code integer,
    error_subcode integer,
    http_status integer,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint automation_attempts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint automation_attempts_outcome_check check (outcome in ('sending', 'accepted', 'rejected', 'rate_limited', 'ambiguous'))
);

-- only the Worker's service role reads the table; the anon key ships in every browser
alter table public.automation_attempts enable row level security;
revoke all on table public.automation_attempts from anon, authenticated;

create trigger automation_attempts_set_updated_at before update on public.automation_attempts
    for each row execute function public.set_updated_at();

-- reserve_automation_send counts the last hour at each scope, and the last day per recipient
create index automation_attempts_started_at_idx on public.automation_attempts (started_at);
create index automation_attempts_user_id_started_at_idx on public.automation_attempts (user_id, started_at);
create index automation_attempts_account_id_started_at_idx on public.automation_attempts (account_id, started_at);
create index automation_attempts_rule_id_started_at_idx on public.automation_attempts (rule_id, started_at) where rule_id is not null;
create index automation_attempts_recipient_idx on public.automation_attempts (account_id, recipient_id, started_at);
-- finish_automation_send and the claim close the attempts of one comment
create index automation_attempts_comment_idx on public.automation_attempts (automation_comment_id);
