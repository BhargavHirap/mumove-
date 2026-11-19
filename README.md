# MUMOVE

<p align="center">
  <strong>One clearer way to move around Mumbai — and, over time, across India.</strong><br/>
  A mobile-first public-transport and multimodal mobility project.
</p>

<p align="center">
  <a href="https://mumove.vercel.app">Open MUMOVE</a> ·
  <a href="https://github.com/BhargavHirap/mumove-/issues">Report a problem</a> ·
  <a href="https://github.com/BhargavHirap/mumove-/discussions">Join the discussion</a>
</p>

> **Project status:** early-stage prototype. MUMOVE is being built in public. Features, transport coverage and data quality are still evolving; please read the coverage notes below before relying on journey information.

## What MUMOVE is trying to solve

Moving through a large city often means switching between separate apps, websites and transport operators. MUMOVE aims to bring journey discovery, public-transport information, nearby stops and community travel conditions into one mobile-friendly experience.

The long-term ambition is broader than Mumbai. Nationwide journey planning will only be enabled where MUMOVE has usable, validated transport data.

## Current prototype

- Multimodal journey comparison for local rail, metro, BEST bus, auto-rickshaw and black-yellow taxi.
- Place lookup using OpenStreetMap-based search.
- Interactive maps using OpenStreetMap tiles and Leaflet.
- Road-distance and duration estimates through OSRM where available, with fallback estimates clearly identified.
- A transport data explorer designed around operators, stops, routes, route-stop sequences, scheduled trips, alerts and vehicle positions.
- A route-graph planner that can compare connections represented in the imported transport dataset.
- A source-aware journey copilot that searches the currently imported database. A generative LLM is not yet connected.
- Community reports for crowding, auto queues, waterlogging and station conditions.

## Coverage and data honesty

MUMOVE must distinguish published facts from estimates and community reports.

- **Map search is broader than timetable coverage.** Finding a place on the map does not mean MUMOVE has public-transport schedules for that place.
- Public-transport journey results depend on validated operator feeds imported into the database. Current timetable coverage is Mumbai-focused.
- The operator registry and source links are references; they do not prove that an operator API is connected.
- The Mumbai BEST/TMT/KDMT GTFS project referenced by the app is community-maintained, not an official operator feed. Its validity dates, calendars and route data must be checked before schedules are presented as current.
- No live vehicle location should be shown unless it comes from a trusted source and is sufficiently recent.
- Community reports are not official operator alerts.
- Road travel estimates are not public-transport departure times. Estimated fares are not guaranteed quotes.
- Ticket purchases, UPI payments, app-cab bookings and operator reservations are not currently connected.

If a source does not publish a value, MUMOVE should say so rather than inventing one.

## Technology

- React 18, Vite and JavaScript
- Supabase (Postgres, Auth-ready data layer and Row Level Security)
- Leaflet and React Leaflet
- OpenStreetMap for map tiles and place discovery
- OSRM for road-route estimates where available
- GitHub Actions for scheduled/import automation

## Run locally

You need Node.js 18 or newer.

```bash
git clone https://github.com/BhargavHirap/mumove-.git
cd mumove-
npm install
```

Create a local `.env` file with the public frontend Supabase values:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
```

Then start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Never put a Supabase service-role key, database password, bot token or other server secret in frontend variables or commit it to Git.

## Database setup

Apply migrations in order:

1. `supabase/schema.sql`
2. `supabase/migrations/202611190001_transport_foundation.sql`
3. `supabase/migrations/202611190002_operator_registry.sql`

Feed ingestion that needs elevated database permissions must run server-side. Keep service-role credentials in protected server-side secrets and preserve source attribution and feed validity metadata.

## Roadmap

The project roadmap is intentionally data-first:

1. Validate the existing Mumbai transport feed and service calendars.
2. Improve route matching, interchange handling and journey alternatives.
3. Add tests for journey planning, data freshness and source attribution.
4. Integrate additional operator datasets only when their licensing, access and validity are understood.
5. Add authorised live arrivals and service alerts where available.
6. Expand city by city across India without implying coverage that has not been built.
7. Explore multilingual journey assistance and operator-authorised ticketing partnerships.

See the [open issues](https://github.com/BhargavHirap/mumove-/issues) for work that can be picked up now.

## Contributing

Contributions are welcome, especially reproducible bug reports, tests, accessibility improvements, documentation and verified transport-data integrations.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. For larger ideas, start a discussion or open an issue so the approach can be agreed before implementation.

## Data sources and attribution

- [Central Railway](https://cr.indianrailways.gov.in/)
- [Western Railway](https://wr.indianrailways.gov.in/)
- [BEST Undertaking](https://www.bestundertaking.com/)
- [MMRDA](https://www.mmrda.maharashtra.gov.in/)
- [Mumbai Metro One](https://www.mumbaimetroone.com/)
- [Mumbai Metro Rail Corporation](https://mmrcl.com/)
- [OpenStreetMap](https://www.openstreetmap.org/copyright)
- [Community Mumbai GTFS reference](https://github.com/croyla/mumbai-gtfs) (MIT-0; community-maintained)

Always check the original publisher for the latest timetable, service notice, fare or licence. Data-source links are not a claim of an active API integration.

## Contact and project

Built by [Bhargav Hirap](https://github.com/BhargavHirap).

- Live prototype: https://mumove.vercel.app
- Source code: https://github.com/BhargavHirap/mumove-
- Issues and feature requests: https://github.com/BhargavHirap/mumove-/issues
