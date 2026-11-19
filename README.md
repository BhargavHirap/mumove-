
MUMOVE — Mumbai Mobility MVP
A mobile-first PWA prototype for community-reported train crowding, auto queues, waterlogging and station congestion.
What's included
Responsive React + Vite interface
Interactive OpenStreetMap via Leaflet
Five pilot stations: Bandra, Khar Road, Santacruz, Andheri and Dadar
Community report submission and confirmation
Local-device demo mode (works without accounts/backend)
Optional Supabase database and realtime updates
Basic PWA manifest and service worker
Important data disclaimer
The included sample reports are DEMO DATA, not live railway, auto-rickshaw or weather feeds. Community reports are estimates and must not be treated as official transport or emergency information. The app does not currently connect to railway APIs, traffic sensors or weather services.
Run locally
Requires Node.js 18+.
npm install
npm run dev
Open the local URL printed by Vite. For phone testing on the same Wi-Fi, use the Network URL printed by Vite.
Build for deployment
npm run build
npm run preview
Deploy the project to Vercel with:
Framework preset: Vite
Build command: npm run build
Output directory: dist
Optional Supabase setup
Create a Supabase project.
Open SQL Editor and run supabase/schema.sql.
Copy .env.example to .env.
Add the Project URL and anon/public key:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
Restart the Vite development server.
Never put a Supabase service-role key in frontend code or commit secrets to GitHub.
MVP limitations / before public launch
Demo mode stores reports only in the current browser's localStorage.
The starter SQL policies are intentionally permissive for a controlled prototype. They are NOT production-grade anti-spam protection.
Add Supabase Auth, per-user rate limits, a separate confirmation/vote table, moderation tools, abuse reporting and stricter RLS before public release.
Add a scheduled database cleanup job for expired reports.
Add real notification infrastructure only after consent and backend validation.
PWA icons and push notifications are not yet configured.
Verify map usage policy and tile-provider limits before scaling.
Suggested next phases
Add authenticated commuter accounts and anti-spam.
Add secure one-vote-per-user confirmations.
Add station geolocation and more stations.
Add admin moderation dashboard.
Add multilingual UI (Marathi/Hindi/English).
Add AI forecasting only after collecting enough consented, quality data.