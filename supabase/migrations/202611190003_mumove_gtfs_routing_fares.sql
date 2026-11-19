-- MUMOVE routing, GTFS calendar and fare foundation.
create table if not exists public.transport_service_calendars (
  service_id text primary key,
  monday boolean not null default false, tuesday boolean not null default false,
  wednesday boolean not null default false, thursday boolean not null default false,
  friday boolean not null default false, saturday boolean not null default false,
  sunday boolean not null default false, start_date date not null, end_date date not null,
  source_ref text not null, updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create table if not exists public.transport_fare_products (
  id text primary key,
  operator_id text not null references public.transport_operators(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0), currency text not null default 'INR',
  payment_method smallint, transfers smallint, source_ref text not null, updated_at timestamptz not null default now()
);
create table if not exists public.transport_fare_rules (
  id bigserial primary key, fare_id text not null references public.transport_fare_products(id) on delete cascade,
  route_id text references public.transport_routes(id) on delete cascade,
  origin_zone_id text, destination_zone_id text, contains_zone_id text
);
alter table public.transport_stops add column if not exists zone_id text;
create index if not exists transport_stops_name_search_idx on public.transport_stops using gin (to_tsvector('simple', name));
create index if not exists transport_service_calendars_dates_idx on public.transport_service_calendars(start_date,end_date);
alter table public.transport_service_calendars enable row level security;
alter table public.transport_fare_products enable row level security;
alter table public.transport_fare_rules enable row level security;
drop policy if exists "Public can read service calendars" on public.transport_service_calendars;
create policy "Public can read service calendars" on public.transport_service_calendars for select to anon,authenticated using (true);
drop policy if exists "Public can read fare products" on public.transport_fare_products;
create policy "Public can read fare products" on public.transport_fare_products for select to anon,authenticated using (true);
drop policy if exists "Public can read fare rules" on public.transport_fare_rules;
create policy "Public can read fare rules" on public.transport_fare_rules for select to anon,authenticated using (true);
create or replace function public.mumove_search_stops(search_term text, result_limit integer default 10)
returns table(id text,name text,operator_id text,stop_type text,latitude double precision,longitude double precision,zone_id text)
language sql stable security invoker set search_path=public as $$
 select s.id,s.name,s.operator_id,s.stop_type,s.latitude,s.longitude,s.zone_id
 from public.transport_stops s
 where length(trim(coalesce(search_term,''))) >= 2 and s.name ilike '%' || trim(search_term) || '%'
 order by case when lower(s.name)=lower(trim(search_term)) then 0 when lower(s.name) like lower(trim(search_term)) || '%' then 1 else 2 end,s.name
 limit greatest(1,least(coalesce(result_limit,10),20));
$$;
grant execute on function public.mumove_search_stops(text,integer) to anon,authenticated;
