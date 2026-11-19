# MUMOVE — Product roadmap and integration boundaries

## Product direction

MUMOVE is intended to become a unified Mumbai Metropolitan Region mobility companion. It should make discovery, comparison, planning, disruption awareness, booking hand-off, payment status and trip support feel like one product, while clearly identifying which operator is the source of each fact.

## Important launch boundary

The current public community GTFS ZIP at https://github.com/croyla/mumbai-gtfs provides static bus schedule data for BEST, TMT and KDMT. It is not an official operator feed and it is not a live GPS feed. It may be imported for route discovery and timetable-based journey planning with clear attribution and freshness labels. Do not describe its scheduled times as live arrivals, and do not claim operator-published fares unless fare products/rules are actually present and verified.

The importer workflow requires GitHub Actions secrets:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

The service-role key must remain a GitHub secret or server-side secret. Never expose it in browser code, VITE_ variables, commits, logs, or chat.

## Product capability layers

### 1. Public information layer
- BEST, TMT and KDMT route/stop search from the community GTFS feed.
- Timetable-based departures and arrival estimates labelled as scheduled, not live.
- Source, licence, last-import timestamp, validity period and data-quality warnings.
- Operator fares only where a trusted source explicitly publishes them.
- Static railway, metro and monorail station/line directory only after sourcing reliable operator data.

### 2. Journey intelligence
- Multimodal route graph for bus, suburban rail, metro and monorail.
- Optimise by fastest, cheapest, fewest transfers, accessible and least walking.
- Transfer walking time, station entrances, interchange guidance, buffer times and service calendars.
- Disruption-aware alternatives only when an authoritative alert feed is available.
- Explain why a route is recommended and show uncertainty.

### 3. Live operations
- Separate adapters for each authorised operator feed.
- Vehicle positions, predicted arrival times, cancellations, platform changes and service alerts only when the operator/provider authorises and publishes them.
- Display feed timestamp, freshness and confidence; fall back to scheduled times if live data is stale.
- Do not scrape private APIs or bypass access controls.

### 4. Booking and payment
- Use operator-authorised APIs, ONDC/approved ticketing partners, or official deep links.
- Start with a booking hand-off to official channels; add in-app checkout only after commercial and technical approval.
- Payment gateway integration must use hosted checkout/tokenisation, server-side order creation, signed webhooks, idempotency, refunds/reconciliation and audit logs.
- Never store card, UPI PIN, CVV, OTP or raw payment credentials.
- Ticket issuance, QR validation, cancellation and refund status must come from the issuing operator/partner. MUMOVE must not fabricate tickets or imply a reservation is confirmed before provider confirmation.

### 5. User experience and AI
- Marathi, Hindi and English assistant; text and voice input/output.
- Assistant grounded in current route, schedule, fare, service-alert and booking records; cite the source and data timestamp in answers.
- Saved places/routes, commute reminders, trip sharing, accessibility preferences, emergency assistance, feedback and support.
- AI must distinguish known facts from estimates and must not invent live arrivals, fares, availability or ticket status.

## Differentiation target

Mumbai already has an integrated official mobility app and third-party ticketing options. MUMOVE should not compete by merely copying a ticket QR screen. Differentiation should focus on:
- one transparent search across fragmented sources, with visible provenance and freshness;
- genuinely useful route comparison and transfer explanations;
- reliable fallback when feeds fail;
- Marathi-first voice accessibility and conversational trip support;
- personalised commute intelligence, disruption alternatives and accessibility-aware routing;
- unified trip history and support status where partner APIs permit;
- open, modular integrations so new operators can be added without rewriting the planner.

## Delivery sequence

1. Import and validate BEST/TMT/KDMT community GTFS; verify actual database row counts and sample route paths.
2. Harden bus search and timetable-based journey planning; add source/freshness indicators and tests.
3. Add railway, metro and monorail station/line/schedule datasets from official or licensed sources.
4. Expand multimodal routing and interchange graph; test against known journeys.
5. Integrate live feeds operator by operator after authorisation.
6. Add official booking hand-offs, then partner ticketing APIs.
7. Add payment orchestration only after an approved ticketing partner and compliance review.
8. Launch multilingual AI assistant grounded in the verified data layer; add voice and proactive alerts.
9. Pilot with commuters, measure itinerary success, ETA error, booking completion, reliability and accessibility.

## Current state

The GTFS importer and manual GitHub Actions workflow are in the repository. A weekly scheduled refresh is configured, but it will fail safely until the two required GitHub Actions secrets are added. The database currently has operator records but no imported stop, route, trip or fare-product rows. No authorised live vehicle feeds or ticketing/payment partners are connected yet.
