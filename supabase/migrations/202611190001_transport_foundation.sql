-- MUMOVE transport-data foundation (additive migration).
-- Apply in Supabase SQL Editor. No fabricated timetable or vehicle data is inserted.
create extension if not exists pgcrypto;

create table if not exists public.transport_operators (
  id text primary key,
  name text not null,
  mode text not null check (mode in ('bus','suburban_rail','metro','ferry','taxi','other')),
  region text not null default 'Mumbai',
  official_url text,
  data_status text not null default 'reference_only'
    check (data_status in ('reference_only','static_schedule','live_feed','temporarily_unavailable')),
  updated_at timestamptz not null default now()
);

create table if not exists public.transport_stops (
  id text primary key,
  operator_id text not null references public.transport_operators(id) on delete cascade,
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  stop_type text not null default 'station'
    check (stop_type in ('bus_stop','rail_station','metro_station','ferry_terminal','interchange','other')),
  wheelchair_accessible boolean,
  source_ref text,
  updated_at timestamptz not null default now()
);

create index if not exists transport_stops_geo_idx
  on public.transport_stops (latitude, longitude);
create index if not exists transport_stops_operator_idx
  on public.transport_stops (operator_id);

create table if not exists public.transport_routes (
  id text primary key,
  operator_id text not null references public.transport_operators(id) on delete cascade,
  route_short_name text,
  route_long_name text not null,
  mode text not null check (mode in ('bus','suburban_rail','metro','ferry','other')),
  origin_stop_id text references public.transport_stops(id) on delete set null,
  destination_stop_id text references public.transport_stops(id) on delete set null,
  direction_label text,
  source_ref text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists transport_routes_operator_idx
  on public.transport_routes (operator_id, mode, active);

create table if not exists public.transport_route_stops (
  route_id text not null references public.transport_routes(id) on delete cascade,
  stop_id text not null references public.transport_stops(id) on delete cascade,
  stop_sequence integer not null check (stop_sequence > 0),
  distance_from_start_m integer check (distance_from_start_m is null or distance_from_start_m >= 0),
  primary key (route_id, stop_sequence),
  unique (route_id, stop_id)
);

create index if not exists transport_route_stops_stop_idx
  on public.transport_route_stops (stop_id);

create table if not exists public.scheduled_trips (
  id text primary key,
  route_id text not null references public.transport_routes(id) on delete cascade,
  service_date date,
  departure_time time not null,
  arrival_time time,
  direction_label text,
  calendar_ref text,
  source_ref text not null,
  source_updated_at timestamptz,
  verified_at timestamptz,
  is_current boolean not null default true,
  check (arrival_time is null or arrival_time >= departure_time)
);

create index if not exists scheduled_trips_route_departure_idx
  on public.scheduled_trips (route_id, service_date, departure_time)
  where is_current = true;

create table if not exists public.trip_stop_times (
  trip_id text not null references public.scheduled_trips(id) on delete cascade,
  stop_id text not null references public.transport_stops(id) on delete cascade,
  stop_sequence integer not null check (stop_sequence > 0),
  arrival_time time not null,
  departure_time time not null,
  pickup_allowed boolean not null default true,
  dropoff_allowed boolean not null default true,
  primary key (trip_id, stop_sequence)
);

create index if not exists trip_stop_times_stop_time_idx
  on public.trip_stop_times (stop_id, arrival_time);

create table if not exists public.transport_service_alerts (
  id uuid primary key default gen_random_uuid(),
  operator_id text references public.transport_operators(id) on delete cascade,
  route_id text references public.transport_routes(id) on delete cascade,
  stop_id text references public.transport_stops(id) on delete cascade,
  title text not null,
  description text not null default '',
  severity text not null default 'info'
    check (severity in ('info','warning','severe')),
  status text not null default 'active'
    check (status in ('active','resolved')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source_name text not null,
  source_url text,
  source_updated_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists transport_alerts_active_idx
  on public.transport_service_alerts (starts_at desc)
  where status = 'active';

create table if not exists public.transport_vehicle_positions (
  id text primary key,
  operator_id text not null references public.transport_operators(id) on delete cascade,
  route_id text references public.transport_routes(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  bearing double precision check (bearing is null or bearing between 0 and 360),
  speed_kmh double precision check (speed_kmh is null or speed_kmh >= 0),
  recorded_at timestamptz not null,
  source_name text not null,
  source_updated_at timestamptz,
  verified_at timestamptz
);

create index if not exists transport_vehicle_positions_time_idx
  on public.transport_vehicle_positions (recorded_at desc);
create index if not exists transport_vehicle_positions_route_idx
  on public.transport_vehicle_positions (route_id, recorded_at desc);

create table if not exists public.transport_data_sources (
  id text primary key,
  operator_id text references public.transport_operators(id) on delete set null,
  name text not null,
  source_type text not null check (source_type in ('official_api','gtfs','gtfs_realtime','official_web','licensed_partner','community','open_data')),
  source_url text,
  access_status text not null default 'not_connected'
    check (access_status in ('not_connected','public','registration_required','approval_required','connected','unavailable')),
  refresh_interval_seconds integer check (refresh_interval_seconds is null or refresh_interval_seconds > 0),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  notes text,
  updated_at timestamptz not null default now()
);

-- Public read-only access for published transport information.
-- All writes/imports must happen server-side with a service-role credential.
alter table public.transport_operators enable row level security;
alter table public.transport_stops enable row level security;
alter table public.transport_routes enable row level security;
alter table public.transport_route_stops enable row level security;
alter table public.scheduled_trips enable row level security;
alter table public.trip_stop_times enable row level security;
alter table public.transport_service_alerts enable row level security;
alter table public.transport_vehicle_positions enable row level security;
alter table public.transport_data_sources enable row level security;

drop policy if exists "Public can read transport operators" on public.transport_operators;
create policy "Public can read transport operators" on public.transport_operators
  for select to anon, authenticated using (true);

drop policy if exists "Public can read transport stops" on public.transport_stops;
create policy "Public can read transport stops" on public.transport_stops
  for select to anon, authenticated using (true);

drop policy if exists "Public can read active transport routes" on public.transport_routes;
create policy "Public can read active transport routes" on public.transport_routes
  for select to anon, authenticated using (active = true);

drop policy if exists "Public can read route stop sequences" on public.transport_route_stops;
create policy "Public can read route stop sequences" on public.transport_route_stops
  for select to anon, authenticated using (true);

drop policy if exists "Public can read current scheduled trips" on public.scheduled_trips;
create policy "Public can read current scheduled trips" on public.scheduled_trips
  for select to anon, authenticated using (is_current = true);

drop policy if exists "Public can read trip stop times" on public.trip_stop_times;
create policy "Public can read trip stop times" on public.trip_stop_times
  for select to anon, authenticated using (true);

drop policy if exists "Public can read active service alerts" on public.transport_service_alerts;
create policy "Public can read active service alerts" on public.transport_service_alerts
  for select to anon, authenticated using (status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()));

drop policy if exists "Public can read recent vehicle positions" on public.transport_vehicle_positions;
create policy "Public can read recent vehicle positions" on public.transport_vehicle_positions
  for select to anon, authenticated using (recorded_at > now() - interval '3 minutes');

-- Feed credentials, operational errors and internal notes are not exposed to browser users.
-- No SELECT policy is created for transport_data_sources.
-- No INSERT/UPDATE/DELETE policies are created for any transport table.
-- Use Supabase Edge Functions or a trusted server with service-role credentials for imports.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transport_service_alerts'
  ) then
    alter publication supabase_realtime add table public.transport_service_alerts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transport_vehicle_positions'
  ) then
    alter publication supabase_realtime add table public.transport_vehicle_positions;
  end if;
end $$;
