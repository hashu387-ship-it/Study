-- Group-wide settings, such as the one meeting link used for every session.
create table public.settings (
  key text primary key,
  value text not null default '',
  updated_by text references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy server_only on public.settings for all to anon
  using ((select private.is_server())) with check ((select private.is_server()));
