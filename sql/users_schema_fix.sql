-- Users table schema & RLS hardening for Supabase Auth
-- شغّل هذه الأوامر في SQL Editor (واجهة Supabase) للتأكد أن جدول users مضبوط ومتوافق مع Auth

-- 1) إنشاء الجدول لو مش موجود
create table if not exists public.users (
  id uuid primary key,
  email text not null,
  name text,
  role text not null default 'parent',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- 2) فرض النوع والربط مع Auth
alter table public.users
  alter column id type uuid using id::uuid,
  alter column id set not null;

alter table public.users drop constraint if exists users_pkey;
alter table public.users add primary key (id);

alter table public.users drop constraint if exists users_id_fkey;
alter table public.users
  add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- 3) حقل البريد: عدم التكرار وعدم السماح بالقيم الفارغة
alter table public.users alter column email set not null;
create unique index if not exists users_email_key on public.users(email);

-- 4) الحقول الافتراضية
alter table public.users alter column role set default 'parent';
alter table public.users alter column status set default 'active';
alter table public.users alter column created_at set default now();
alter table public.users alter column created_at set not null;

-- 5) تفعيل RLS
alter table public.users enable row level security;

-- 6) سياسات الاستخدام (مع حماية من التكرار لو كانت موجودة)
-- سياسة القراءة: يرى المستخدم صفه فقط
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'users_select_own') THEN
    CREATE POLICY users_select_own ON public.users
      FOR SELECT USING (id = auth.uid());
  END IF;
END $$;

-- سياسة الإضافة: يضيف صف لنفسه فقط
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'users_insert_own') THEN
    CREATE POLICY users_insert_own ON public.users
      FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- سياسة التعديل: يعدّل صفه فقط
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'users_update_own') THEN
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

-- (اختياري) سياسة للمشرفين بناءً على claim في الـ JWT
-- يفترض وجود claim باسم role يساوي 'admin'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'users_admin_full_access') THEN
    CREATE POLICY users_admin_full_access ON public.users
      FOR ALL USING ((auth.jwt() ->> 'role') = 'admin');
  END IF;
END $$;

-- 7) صلاحيات تنفيذ القواعد
grant select, insert, update on public.users to authenticated, anon;
