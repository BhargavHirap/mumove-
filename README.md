# MUMOVE — Mumbai-first mobility platform

A mobile-first React + Vite PWA prototype that combines journey estimates, community travel conditions, nearby mapped stops and a source-aware transport data explorer.

## What is implemented

- Multi-modal journey comparison for local rail, metro, BEST bus, auto-rickshaw and black-yellow taxi.
- Road-distance/time estimation through OSRM where available; otherwise a clearly labelled fallback estimate.
- Fare guidance: BEST adult non-AC distance slabs from the published BMC Year Book 2025 table; auto and black-yellow taxi meter estimates use the revised MMR tariff values announced for September 2026. Railway and metro fares remain operator-check links until station-to-station fare tables are integrated.
- Transport data explorer backed by Supabase tables for operators, stops, routes, route-stop sequences, scheduled trips, alerts and recent vehicle positions.
- Nearby stop search against imported operator-linked stops; the existing map also uses OpenStreetMap mapped stop discovery around a location the commuter chooses to share.
- Multi-operator route graph search across imported route-stop sequences.
- Source directory for Central Railway, Western Railway, BEST, MMRDA, Mumbai Metro One, MMRCL and public data references.
- Early journey copilot that searches the currently imported database and provides transparent source-aware guidance. A generative LLM is not yet connected.
- Community crowding, auto-queue, waterlogging and station-condition reports.
- Live weather context and interactive OpenStreetMap map.

## Important data integrity rules

- The operator registry and official source links do not mean an operator API is connected.
- The transport tables are currently empty of route, stop, timetable, alert and vehicle-position records. No fake service data is inserted.
- The Mumbai BEST/TMT/KDMT GTFS repository linked in the app is community-maintained under MIT-0, not an official BEST feed. It must be validated and imported with service calendars before departures are treated as current.
- Central Railway and Western Railway publish timetable documents on their official sites; no authorised machine-readable suburban timetable feed is connected.
- MMRDA, Mumbai Metro One and MMRCL source links are references only; no live metro arrivals feed is connected.
- Live vehicle positions are displayed only when a trusted source provides a position recorded within the last three minutes.
- Community reports are not official operator alerts.
- Road route duration is not a transit departure time. Fare values are estimates, not guaranteed quotes.
- App-cab booking, UPI payments, ticketing and operator reservations are not connected.

## Database

Apply migrations in order:
1. `supabase/schema.sql`
2. `supabase/migrations/202611190001_transport_foundation.sql`
3. `supabase/migrations/202611190002_operator_registry.sql`

Frontend environment variables:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon key only). Never put a service-role or secret key in the browser or GitHub.

Transport tables use RLS. Published transport information is read-only to browser clients. Feed ingestion must run server-side using a service-role credential stored only in server-side secrets.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
npm run build
```

## Official references

- Central Railway suburban timetable: https://cr.indianrailways.gov.in/offerings/schemes-and-services/preview/1122
- Western Railway suburban timetable: https://wr.indianrailways.gov.in/offerings/custom/Mumbai%20Suburban/preview/523
- BEST Undertaking: https://www.bestundertaking.com/
- BEST Prawas passenger app: https://play.google.com/store/apps/details?id=com.dimts.best.bestapplication
- MMRDA: https://www.mmrda.maharashtra.gov.in/
- Mumbai Metro One: https://www.mumbaimetroone.com/
- MMRCL: https://mmrcl.com/
- Community GTFS reference (MIT-0): https://github.com/croyla/mumbai-gtfs

## Next integration requirements

1. Validate and ingest the community BEST GTFS feed, preserving attribution, feed validity dates and service calendars.
2. Obtain/confirm operator permission or official downloadable datasets for suburban rail and metro timetable ingestion.
3. Integrate authorised live vehicle positions and service alerts (GTFS-Realtime or operator APIs) after access approval.
4. Add fare tables by operator, route, passenger class and effective date.
5. Add authentication, report rate limits, moderation and one-vote-per-user confirmations before public launch.
6. Connect a server-side LLM provider for multilingual AI journey assistance; keep provider keys out of the browser.
7. Add operator-authorised booking/ticketing partnerships before offering purchases.
