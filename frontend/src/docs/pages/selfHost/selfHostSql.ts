export const SCHEMA_SQL = `
create table accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  data jsonb not null
);
create index accounts_user_id_idx on accounts(user_id);

create table settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  primary key (user_id, key)
);

create table scheduled_posts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  status text not null default 'pending',
  scheduled_at timestamptz not null,
  data jsonb
);
create index scheduled_posts_due_idx on scheduled_posts(status, scheduled_at);

create table tracked_posts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text references accounts(id) on delete set null,
  url text not null,
  label text not null default '',
  category text not null default '',
  content_type text not null default 'reddit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb
);
create index tracked_posts_user_id_idx on tracked_posts(user_id);

alter table accounts enable row level security;
alter table settings enable row level security;
alter table scheduled_posts enable row level security;
alter table tracked_posts enable row level security;
`;

export const RLS_SQL = `
alter table accounts enable row level security;
alter table settings enable row level security;
alter table scheduled_posts enable row level security;
alter table tracked_posts enable row level security;
`;

export const UPGRADE_SQL = `
alter table tracked_posts add column if not exists content_type text not null default 'reddit';
${RLS_SQL.trim()}
`;
