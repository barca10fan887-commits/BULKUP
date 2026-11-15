-- BULKUP: complete database setup. Paste this whole file into Supabase > SQL Editor > New query, then click Run.

-- BULKUP schema. Run in the Supabase SQL editor (or `supabase db push`).
-- Every table is protected by row-level security so a signed-in user can only
-- see and change rows where user_id = auth.uid(). Deleting the auth user
-- cascades and removes all of their rows.

create extension if not exists "pgcrypto";

-- Profile: one row per user, profile document stored as JSON.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast','lunch','dinner','snacks')),
  name text not null check (char_length(name) <= 200),
  brand text,
  serving_label text not null default '',
  quantity numeric not null default 1,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  source text not null default 'manual',
  barcode text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists food_entries_user_date on public.food_entries (user_id, date);

create table if not exists public.custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  serving_size numeric not null,
  serving_unit text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_foods_user on public.custom_foods (user_id);

create table if not exists public.favourite_meals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  meal text not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists favourite_meals_user on public.favourite_meals (user_id);

create table if not exists public.water_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  ml numeric not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists water_logs_user_date on public.water_logs (user_id, date);

create table if not exists public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  exercises jsonb not null default '[]',
  scheduled_days int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_user on public.routines (user_id);

create table if not exists public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  routine_id uuid,
  name text not null,
  exercises jsonb not null default '[]',
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_min numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_date on public.workout_sessions (user_id, date);

create table if not exists public.body_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric,
  chest_cm numeric,
  arm_cm numeric,
  waist_cm numeric,
  leg_cm numeric,
  custom jsonb not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists body_entries_user_date on public.body_entries (user_id, date);

create table if not exists public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  path text not null,
  pose text not null default 'front',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists progress_photos_user on public.progress_photos (user_id);

create table if not exists public.supplements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null,
  serving_amount numeric not null,
  serving_unit text not null,
  daily_servings numeric not null default 1,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  container_cost numeric,
  servings_per_container numeric,
  reminder_time text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplements_user on public.supplements (user_id);

create table if not exists public.supplement_logs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  supplement_id uuid not null,
  servings numeric not null default 1,
  time text not null,
  food_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists supplement_logs_user_date on public.supplement_logs (user_id, date);

create table if not exists public.check_ins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_ending date not null,
  stats jsonb not null,
  energy int not null,
  sleep int not null,
  hunger int not null,
  notes text not null default '',
  review text,
  review_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists check_ins_user on public.check_ins (user_id);

create table if not exists public.coach_messages (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_messages_user on public.coach_messages (user_id);

-- Row-level security: owner-only access on every table.
do $$
declare t text;
begin
  foreach t in array array[
    'food_entries','custom_foods','favourite_meals','water_logs','routines','workout_sessions',
    'body_entries','progress_photos','supplements','supplement_logs','check_ins','coach_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner select" on public.%I', t);
    execute format('drop policy if exists "owner insert" on public.%I', t);
    execute format('drop policy if exists "owner update" on public.%I', t);
    execute format('drop policy if exists "owner delete" on public.%I', t);
    execute format('create policy "owner select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "owner all" on public.profiles;
create policy "owner all" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Private storage bucket for progress photos. Objects live under <user_id>/...
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "photo owner read" on storage.objects;
drop policy if exists "photo owner write" on storage.objects;
drop policy if exists "photo owner update" on storage.objects;
drop policy if exists "photo owner delete" on storage.objects;
create policy "photo owner read" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photo owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photo owner update" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photo owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Lets a signed-in user permanently delete their own account from inside the app
-- (required by the App Store). All their rows are removed by ON DELETE CASCADE.
-- Their progress photos are removed by the app just before this is called.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
