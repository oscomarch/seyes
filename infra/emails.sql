-- The download page's email list. Paste this into the Supabase SQL editor
-- once, in a project made for Seyes.
--
-- Anyone (the page, with the public anon key) can ADD an email. Nobody can
-- read, change or delete them except you, from the dashboard, because there
-- is no policy that allows it.

create table if not exists public.emails (
  id          bigint generated always as identity primary key,
  email       text not null unique
              check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source      text check (length(source) <= 64),   -- where they came from: tiktok, instagram, ...
  locale      text check (length(locale) <= 16),   -- their browser language, e.g. fr-FR
  created_at  timestamptz not null default now()
);

alter table public.emails enable row level security;

drop policy if exists "the page can add an email" on public.emails;
create policy "the page can add an email"
  on public.emails for insert
  to anon
  with check (true);

revoke select, update, delete on public.emails from anon, authenticated;
