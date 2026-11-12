-- SplashQR database. Paste this whole file into Supabase > SQL Editor and click Run.

-- Profiles: one per signed-up user. New users get 14 days of Pro (reverse trial).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Codes: every QR code a user makes. The design (links, colors, loading screen, QR style) is one JSON blob.
create table if not exists public.codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled code',
  slug text not null unique,
  kind text not null check (kind in ('links', 'web', 'phone', 'email')),
  mode text not null check (mode in ('dynamic', 'static')),
  design jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists codes_user_idx on public.codes (user_id, created_at);

-- Scans: one row per scan of a dynamic code. Written only by the server.
create table if not exists public.scans (
  id bigint generated always as identity primary key,
  code_id uuid not null references public.codes (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  device text,          -- iPhone / Android / Computer / Other
  country text,
  region text,
  city text,
  visitor text          -- daily hashed visitor id, for unique counts (no raw IPs stored)
);
create index if not exists scans_code_time_idx on public.scans (code_id, scanned_at desc);

-- Row level security: people only see and change their own things.
alter table public.profiles enable row level security;
alter table public.codes enable row level security;
alter table public.scans enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "own codes read" on public.codes;
create policy "own codes read" on public.codes for select using (auth.uid() = user_id);
drop policy if exists "own codes insert" on public.codes;
create policy "own codes insert" on public.codes for insert with check (auth.uid() = user_id);
drop policy if exists "own codes update" on public.codes;
create policy "own codes update" on public.codes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own codes delete" on public.codes;
create policy "own codes delete" on public.codes for delete using (auth.uid() = user_id);

drop policy if exists "own scans read" on public.scans;
create policy "own scans read" on public.scans for select
  using (exists (select 1 from public.codes c where c.id = code_id and c.user_id = auth.uid()));

-- Logo storage: anyone can view logos (they appear on public pages), users upload into their own folder.
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;

drop policy if exists "logo upload own folder" on storage.objects;
create policy "logo upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "logo update own folder" on storage.objects;
create policy "logo update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "logo delete own folder" on storage.objects;
create policy "logo delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
