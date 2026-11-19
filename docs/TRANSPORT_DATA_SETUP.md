# MUMOVE transport data integration

## What is connected

- Supabase stores operators, stops, routes, GTFS calendars, scheduled trips, stop times, fare products/rules, service alerts and vehicle positions.
- The planner searches imported stop names and calculates direct or one-transfer paths from trip-specific GTFS stop sequences.
- Duration is a transparent heuristic (3 minutes per stop plus an 8-minute transfer buffer), not a published timetable or ETA.
- Fare is displayed only when the imported GTFS feed contains matching fare rules.
- The AI endpoint uses an OpenAI-compatible chat completion API and grounds answers in database stop/alert context.
- The protected realtime ingest endpoint accepts normalized vehicle positions and service alerts from an operator-authorised adapter.

## Import Mumbai bus GTFS

Configured community feed: https://github.com/croyla/mumbai-gtfs . It covers BEST/TMT/KDMT but is not an official BEST feed. The importer validates coordinates, checks service calendars for today/next 14 days, records provenance and batches database writes. Requires Node.js 20+.

From a trusted local terminal:

    npm install
    SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_KEY npm run import:gtfs

Never put the service-role key in a VITE_ variable, commit it or paste it into source code. Rerun the importer when the upstream feed is refreshed.

## Vercel environment variables

Set these in Project Settings → Environment Variables, then redeploy:

- SUPABASE_URL: same project URL as VITE_SUPABASE_URL (the API falls back to VITE_SUPABASE_URL if omitted).
- SUPABASE_SERVICE_ROLE_KEY: Supabase service-role/secret key, server-only.
- MUMOVE_OPENAI_API_KEY: key for the configured OpenAI-compatible AI endpoint.
- MUMOVE_AI_MODEL (optional): defaults to gpt-4o-mini.
- MUMOVE_AI_ENDPOINT (optional): defaults to https://api.openai.com/v1/chat/completions.
- MUMOVE_INGEST_TOKEN: long random bearer token shared only with an authorised realtime feed adapter.

Do not add server-only values with a VITE_ prefix.

## Realtime adapter contract

POST JSON to /api/realtime-ingest with Authorization: Bearer <MUMOVE_INGEST_TOKEN>. Payload shape:

    {
      "source_name": "Operator-authorised feed",
      "vehicles": [{"id":"vehicle-id","operator_id":"best","route_id":"gtfs-route-id","latitude":19.076,"longitude":72.877,"bearing":90,"speed_kmh":24,"recorded_at":"2026-11-19T10:00:00+05:30"}],
      "alerts": [{"operator_id":"best","title":"Service disruption","description":"Operator-provided text","severity":"warning","starts_at":"2026-11-19T10:00:00+05:30","source_url":"https://operator.example/notice"}]
    }

Only current positions (less than 3 minutes old) are accepted. Do not connect scraping, unofficial private endpoints or another app's credentials. BEST/rail/metro live feeds require operator approval or a documented public feed. No live vehicle source is activated by this repository change.

## Railway and metro coverage

The existing operator registry and official reference links remain in place. This import supplies bus routes only. To calculate local-train and metro journeys, add operator-published GTFS/GTFS-RT or licensed timetable data using the same import model. Do not turn corridor names into fake station-to-station timetables.

## Data provenance and limitations

- Community GTFS = static schedules, not live GPS.
- OpenStreetMap nearby points = mapped locations, not service schedules.
- Service calendars are checked for the current day/next 14 days at import time.
- Planner durations are indicative, not operator guarantees.
- Fare is unavailable unless fare products and route rules exist in the source feed.
- Ticket purchase, live booking and operator transactions are not implemented.
