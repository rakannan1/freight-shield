-- Per-user alert preferences (channels, SMS threshold, digest cadence, extra recipients).
create table if not exists public.alert_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_digest boolean not null default true,
  digest_cadence text not null default 'weekly' check (digest_cadence in ('weekly', 'daily')),
  sms_enabled boolean not null default false,
  sms_phone text,
  sms_threshold text not null default 'critical' check (sms_threshold in ('critical', 'critical_review')),
  slack_enabled boolean not null default false,
  slack_webhook_url text,
  extra_recipients text[] not null default '{}',
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.alert_settings enable row level security;
create policy "own settings" on public.alert_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
