create table if not exists public.users (
  id uuid primary key,
  email text not null,
  name text,
  role text not null default 'parent',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
END $$;

alter table public.users
  alter column id type uuid using id::uuid,
  alter column id set not null;

alter table public.users drop constraint if exists users_pkey;
alter table public.users add primary key (id);

alter table public.users drop constraint if exists users_id_fkey;
alter table public.users
  add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.users alter column email set not null;
create unique index if not exists users_email_key on public.users(email);

alter table public.users alter column role set default 'parent';
alter table public.users alter column status set default 'active';
alter table public.users alter column created_at set default now();
alter table public.users alter column created_at set not null;

alter table public.users enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own ON public.users
      FOR SELECT USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_insert_own'
  ) THEN
    CREATE POLICY users_insert_own ON public.users
      FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_admin_full_access'
  ) THEN
    CREATE POLICY users_admin_full_access ON public.users
      FOR ALL USING ((auth.jwt() ->> 'role') = 'admin');
  END IF;
END $$;

grant select, insert, update on public.users to authenticated, anon;
