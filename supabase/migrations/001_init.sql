-- Freight Watch: initial schema
-- Users come from Supabase Auth (auth.users). One watchlist per user.

create table if not exists public.carriers (
  dot_number text primary key,
  mc_number text,
  legal_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dot_number text not null references public.carriers(dot_number) on delete cascade,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, dot_number)
);

-- One row per carrier per fetch; the latest row is the baseline for the next diff.
create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  dot_number text not null references public.carriers(dot_number) on delete cascade,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists snapshots_dot_fetched_idx
  on public.snapshots (dot_number, fetched_at desc);

-- Findings produced by the rules engine, per carrier (shared across watchers).
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  dot_number text not null references public.carriers(dot_number) on delete cascade,
  rule text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  detail text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists alerts_dot_created_idx
  on public.alerts (dot_number, created_at desc);

-- Which user was emailed about which alert.
create table if not exists public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emailed_at timestamptz,
  summary text,
  unique (alert_id, user_id)
);

-- Row-level security: users see only their own watches, and alerts/snapshots
-- only for carriers they watch. The cron job uses the service role and bypasses RLS.
alter table public.carriers enable row level security;
alter table public.watches enable row level security;
alter table public.snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_deliveries enable row level security;

create policy "own watches" on public.watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watched carriers" on public.carriers
  for select using (
    exists (select 1 from public.watches w
            where w.dot_number = carriers.dot_number and w.user_id = auth.uid())
  );

create policy "watched snapshots" on public.snapshots
  for select using (
    exists (select 1 from public.watches w
            where w.dot_number = snapshots.dot_number and w.user_id = auth.uid())
  );

create policy "watched alerts" on public.alerts
  for select using (
    exists (select 1 from public.watches w
            where w.dot_number = alerts.dot_number and w.user_id = auth.uid())
  );

create policy "own deliveries" on public.alert_deliveries
  for select using (auth.uid() = user_id);
