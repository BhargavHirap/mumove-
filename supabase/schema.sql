-- MUMOVE MVP schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  station text not null check (station in ('Bandra','Khar Road','Santacruz','Andheri','Dadar')),
  category text not null check (category in ('train','auto','waterlogging','station')),
  level text not null,
  note text default '' check (char_length(note) <= 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmations integer not null default 0 check (confirmations >= 0)
);

create index if not exists reports_recent_idx on public.reports (created_at desc);
create index if not exists reports_expiry_idx on public.reports (expires_at);

alter table public.reports enable row level security;

create policy "Anyone can read unexpired reports"
on public.reports for select
using (expires_at > now());

create policy "Anyone can submit a report"
on public.reports for insert
with check (
  station in ('Bandra','Khar Road','Santacruz','Andheri','Dadar')
  and category in ('train','auto','waterlogging','station')
  and expires_at <= now() + interval '45 minutes'
  and expires_at > now()
);

create policy "Anyone can update confirmations"
on public.reports for update
using (expires_at > now())
with check (confirmations >= 0);

alter publication supabase_realtime add table public.reports;