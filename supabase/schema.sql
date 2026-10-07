-- JobPilot schema. Paste into Supabase → SQL editor → Run.
-- The app talks to these tables server-side only (service role key), so RLS stays on with no public policies.
create table if not exists users  (id uuid primary key, user_id uuid, data jsonb not null, created_at timestamptz default now());
create table if not exists jobs   (id uuid primary key, user_id uuid references users(id) on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists events (id uuid primary key, user_id uuid references users(id) on delete cascade, data jsonb not null, created_at timestamptz default now());
create index if not exists jobs_user on jobs(user_id);
create index if not exists events_user on events(user_id);
create unique index if not exists users_demo_id on users ((data->>'demo_id'));
alter table users enable row level security;
alter table jobs enable row level security;
alter table events enable row level security;
