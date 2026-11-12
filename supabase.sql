-- Im SQL Editor des eigenen Supabase-Projekts einmal ausführen.
create table if not exists public.user_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_documents enable row level security;
create policy "own documents select" on public.user_documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "own documents insert" on public.user_documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own documents update" on public.user_documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Ein Datensatz pro Nutzer. Nicht für gemeinsame Firmenkonten oder konfliktfreies Multiuser-Editing gedacht.
