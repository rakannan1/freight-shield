-- Billing state (written by the Stripe webhook with the service role)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'none',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Which alerts a user has marked reviewed
create table if not exists public.alert_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, alert_id)
);
alter table public.alert_reviews enable row level security;
create policy "own reviews" on public.alert_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Latest snapshot per carrier. security_invoker makes the view obey the caller's RLS.
create or replace view public.latest_snapshots
with (security_invoker = true) as
select distinct on (dot_number) dot_number, data, fetched_at
from public.snapshots
order by dot_number, fetched_at desc;
