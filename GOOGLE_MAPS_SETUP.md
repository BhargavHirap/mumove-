# Google Maps setup for MUMOVE

MUMOVE supports Google Maps rendering and Google transit alternatives, but API credentials must be supplied by the project owner.

## Google Cloud setup
1. Create/select a Google Cloud project and enable billing.
2. Enable **Maps JavaScript API** and **Routes API**.
3. Create a browser key restricted to Maps JavaScript API and HTTP referrers:
   - https://mumove.vercel.app/*
   - https://*.vercel.app/*
4. Create a separate server key restricted to Routes API. Do not expose this key in frontend code.

## Vercel environment variables
Set these in Project → Settings → Environment Variables, for Production and Preview as appropriate:
- `VITE_GOOGLE_MAPS_API_KEY` = browser-restricted Maps JavaScript key
- `GOOGLE_MAPS_API_KEY` = server-only Routes API key

Redeploy after adding them. Never commit either key to GitHub.

## Current behaviour
- With the browser key, nearby and journey maps use Google Maps.
- Without the browser key, the app keeps the existing OpenStreetMap fallback.
- With the server key, the journey planner requests Google public-transit alternatives from the Routes API and displays them alongside locally imported GTFS results.
- Google transit coverage and route availability vary by place and time. Google routes do not replace official operator timetables, fares, live vehicle feeds, or nationwide operator data.
- The locally imported GTFS database currently contains community-maintained Mumbai bus data. Other cities and transport modes need their own authorised/public feeds to provide verified MUMOVE results.
