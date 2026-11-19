# MUMOVE transport data setup

## Supabase setup

1. Open the Supabase project dashboard.
2. Select **SQL Editor → New query** and run `supabase/schema.sql` first (this creates the community reports table used by the current app).
3. Open another query and run `supabase/migrations/202611190001_transport_foundation.sql` (this creates the transport-data foundation).
4. In **Project Settings → API**, copy the Project URL and the publishable/anon key.
5. Add them to the Vercel project as:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   Target: Production, Preview and Development.

Never use a Supabase `service_role` / secret key in browser code or Vite environment variables. Server-side import jobs will need a separate secret.

## What the migration creates

- Operators and data-source registry
- Stops, routes and ordered route-stop sequences
- Scheduled trips and per-stop timetable times
- Official service alerts
- Timestamped vehicle positions
- Read-only browser policies for published transport data

The migration intentionally inserts **no fabricated routes, schedules, fares or vehicle positions**. Tables remain empty until an official/open/licensed dataset has been verified and imported. Browser clients can read public transport information but cannot write transport data. Feed imports must run server-side.

## Data trust rules

- A timetable is labelled **scheduled**, never live.
- A vehicle position is shown as live only when its source timestamp is within three minutes and its source is authorised/verified.
- An alert is shown as official only when its source is an operator or authorised government feed.
- Community reports remain separate from official data.
- If a feed is unavailable or stale, show the last update time and a clear unavailable/stale label.
