-- Per-user AI usage log, used by the Edge Function to enforce daily limits.
-- Only the Edge Function (secret key) can read or write it: RLS is on with no policies.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('coach', 'scan')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_kind_time on public.ai_usage (user_id, kind, created_at);
alter table public.ai_usage enable row level security;
