-- RICS Group 03 Study Hub schema.
--
-- The app has no user login. The Next.js server talks to Supabase with the
-- project's publishable key, which is never sent to browsers, and adds an
-- `x-app-key` header. Every table and the file bucket only answer requests
-- whose header hashes to the value stored in private.app_secret, so a leaked
-- publishable key on its own reads and writes nothing.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create table private.app_secret (
  id int primary key default 1 check (id = 1),
  key_hash text not null
);
revoke all on private.app_secret from public, anon, authenticated;

create or replace function private.is_server()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.app_secret s
    where s.key_hash = encode(
      extensions.digest(
        coalesce(current_setting('request.headers', true)::json ->> 'x-app-key', ''),
        'sha256'
      ),
      'hex'
    )
  );
$$;

grant usage on schema private to anon;
revoke all on function private.is_server() from public;
grant execute on function private.is_server() to anon;

-- Members ------------------------------------------------------------------

create table public.members (
  id text primary key,
  name text not null check (length(name) between 1 and 80),
  pathway text not null default 'Quantity Surveying & Construction',
  notes text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  is_leader boolean not null default false,
  sort int not null default 0,
  revision int not null default 1,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Files (metadata; the bytes live in the group-files storage bucket) --------

create table public.files (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  name text not null,
  content_type text not null,
  size bigint not null default 0,
  context text not null,
  uploaded_by text references public.members (id),
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Study calendar -------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  kind text not null default 'study'
    check (kind in ('study', 'qa', 'workshop', 'case', 'mock', 'other')),
  -- Calendar day in UAE / Oman time (UTC+4). Timed sessions also set starts_at.
  session_date date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  hours numeric(4, 2) check (hours is null or (hours > 0 and hours <= 24)),
  notes text not null default '',
  reminder_minutes int not null default 30
    check (reminder_minutes in (0, 15, 30, 60, 1440)),
  status text not null default 'Planned'
    check (status in ('Planned', 'Completed', 'Cancelled')),
  reminded_at timestamptz,
  revision int not null default 1,
  updated_by text,
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index sessions_date_idx on public.sessions (session_date);

create table public.attendance (
  session_id uuid not null references public.sessions (id) on delete cascade,
  member_id text not null references public.members (id) on delete cascade,
  status text not null check (status in ('present', 'late', 'excused', 'absent')),
  marked_by text references public.members (id),
  marked_at timestamptz not null default now(),
  primary key (session_id, member_id)
);

-- SOE register and Q&A practice ------------------------------------------------

create table public.soe (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.members (id) on delete cascade,
  competency text not null check (length(competency) between 1 and 120),
  competency_type text not null default 'Technical'
    check (competency_type in ('Mandatory', 'Optional', 'Technical')),
  level1 text not null default '',
  level2 text not null default '',
  level3 text not null default '',
  level1_file uuid references public.files (id) on delete set null,
  level2_file uuid references public.files (id) on delete set null,
  level3_file uuid references public.files (id) on delete set null,
  questioner_id text references public.members (id) on delete set null,
  status text not null default 'Not Started',
  notes text not null default '',
  submitted_at timestamptz,
  submitted_by text,
  revision int not null default 1,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (member_id, competency),
  check (questioner_id is null or questioner_id <> member_id),
  check (length(level1) <= 30000 and length(level2) <= 30000 and length(level3) <= 30000)
);

create table public.qa (
  id uuid primary key default gen_random_uuid(),
  soe_id uuid not null references public.soe (id) on delete cascade,
  number int not null check (number between 1 and 20),
  question text not null default '',
  context text not null default '',
  action text not null default '',
  basis text not null default '',
  outcome text not null default '',
  feedback text not null default '',
  status text not null default 'Not Started',
  revision int not null default 1,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (soe_id, number)
);

-- Case studies and presentations ---------------------------------------------

create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  member_id text not null unique references public.members (id) on delete cascade,
  title text not null default '',
  summary text not null default '',
  questions text not null default '',
  status text not null default 'Not Started',
  notes text not null default '',
  presentation_status text not null default 'Not started'
    check (presentation_status in ('Not started', 'In progress', 'Ready', 'Presented')),
  slides_file uuid references public.files (id) on delete set null,
  revision int not null default 1,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Discussions ----------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.posts (id) on delete cascade,
  member_id text not null references public.members (id),
  title text not null default '',
  body text not null check (length(body) between 1 and 20000),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index posts_parent_created_idx on public.posts (parent_id, created_at);

-- Announcements with "seen by" -----------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references public.members (id),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  member_id text not null references public.members (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (announcement_id, member_id)
);

-- Activity feed and push -------------------------------------------------------

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  ref text not null default '',
  title text not null,
  body text not null default '',
  actor text references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notices_created_idx on public.notices (created_at desc);

create table public.notice_reads (
  device_id text primary key,
  read_at timestamptz not null
);

create table public.push_subscriptions (
  endpoint text primary key,
  device_id text not null,
  member_id text references public.members (id) on delete set null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index push_device_idx on public.push_subscriptions (device_id);

-- Row level security: only the app server (valid x-app-key header) ------------

do $$
declare t text;
begin
  foreach t in array array[
    'members', 'files', 'sessions', 'attendance', 'soe', 'qa', 'case_studies',
    'posts', 'announcements', 'announcement_reads', 'notices', 'notice_reads',
    'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy server_only on public.%I for all to anon using ((select private.is_server())) with check ((select private.is_server()))',
      t
    );
  end loop;
end $$;

-- File bucket ------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('group-files', 'group-files', false, 26214400)
on conflict (id) do nothing;

create policy group_files_server_select on storage.objects for select to anon
  using (bucket_id = 'group-files' and (select private.is_server()));
create policy group_files_server_insert on storage.objects for insert to anon
  with check (bucket_id = 'group-files' and (select private.is_server()));
create policy group_files_server_update on storage.objects for update to anon
  using (bucket_id = 'group-files' and (select private.is_server()));
create policy group_files_server_delete on storage.objects for delete to anon
  using (bucket_id = 'group-files' and (select private.is_server()));
