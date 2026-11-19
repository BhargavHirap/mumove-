import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const clean = value => String(value || "").trim().replace(/[?!.,]+$/g, "").trim();
const modeLabel = value => value === "bus_stop" ? "bus stop" : value === "rail_station" ? "rail station" : value === "metro_station" ? "metro station" : "transport stop";

async function searchStops(db, term, limit = 8) {
  if (!term || term.length < 2) return [];
  const { data, error } = await db.rpc("mumove_search_stops", {
    search_term: term,
    result_limit: limit
  });
  if (error) {
    console.error("MUMOVE stop search failed:", error.message);
    return [];
  }
  const unique = new Map((data || []).map(row => [row.id, row]));
  return [...unique.values()];
}

function extractPlace(message) {
  const q = clean(message);
  const match = q.match(/\b(?:near|around|at|in)\s+(.+?)(?:[?.!,]|$)/i);
  if (match) return clean(match[1].replace(/\b(bus stops?|railway stations?|train stations?|metro stations?|stops?)\b/ig, ""));
  return clean(q.replace(/\b(find|show|search|me|the|a|an|bus|stops?|station|stations|nearby|transport)\b/ig, " ").replace(/\s+/g, " "));
}

function groundedReply(message, stopMatches, alerts) {
  const q = message.toLowerCase();
  if (/andheri/.test(q) && /csmt|chhatrapati shivaji|vt station|victoria terminus/.test(q) && /from|to|travel|reach|go|journey/.test(q)) {
    return "A practical local-train route is: 1) At Andheri, board a Churchgate-bound Western Line local. 2) Get down at Dadar. 3) Change to the Central Line and board a CSMT-bound local. 4) Get down at Chhatrapati Shivaji Maharaj Terminus (CSMT). Allow roughly 45–60 minutes including the Dadar interchange, depending on the train and wait. This is general route guidance, not a live fastest-route calculation: MUMOVE does not yet have verified local-train timetables or live arrivals connected. Check station indicators and official railway updates before boarding. A suitable Andheri–CSMT Harbour Line service may avoid the Dadar change, but check that it operates at your travel time.";
  }
  const journey = q.match(/(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\?|$)/i);
  if (journey) {
    const from = clean(journey[1]);
    const to = clean(journey[2]);
    const fromHits = stopMatches.filter(x => x._query === "from");
    const toHits = stopMatches.filter(x => x._query === "to");
    const format = rows => rows.slice(0, 3).map(x => x.name + " (" + modeLabel(x.stop_type) + ")").join(", ");
    if (!fromHits.length || !toHits.length) {
      return "I couldn't match both places to the imported MUMOVE stop database. I searched for " + from + " and " + to + ". Try choosing the exact stop suggestions in Plan. A stop match alone does not prove that a bus serves both places.";
    }
    return "MUMOVE found origin stops near " + from + ": " + format(fromHits) + ". Destination matches near " + to + ": " + format(toHits) + ". These are static community GTFS records. I can only confirm a journey when an active imported trip contains both stops in the correct order; no live arrival or fare is inferred from stop matches.";
  }
  if (/live|track|eta|arrival|where.*bus/i.test(q)) {
    if (/train|rail|local/i.test(q)) return "No. MUMOVE is not connected to an authorised real-time Mumbai local train arrival or train-position feed. The bus GTFS import is a static timetable; it does not provide live train arrivals. Please check the official railway enquiry channels for current arrivals and disruptions.";
    if (/metro/i.test(q)) return "No. MUMOVE is not connected to an authorised real-time Mumbai Metro arrival or vehicle-position feed. Metro corridor reference information is not a live arrival feed.";
    return "MUMOVE does not currently have an authorised live bus vehicle-position or ETA feed connected. The imported community GTFS data is a static schedule, not live tracking. I will not label scheduled times as live arrivals.";
  }
  if (/near|nearby|stop|station|bandr|bandra/i.test(q)) {
    const rows = stopMatches.filter(x => !x._query);
    if (rows.length) return "I found " + rows.length + " matching stop records in the imported database: " + rows.slice(0, 8).map(x => x.name + " (" + modeLabel(x.stop_type) + (x.operator_id ? ", " + x.operator_id.toUpperCase() : "") + ")").join("; ") + ". These are timetable-feed stop matches, not a distance ranking. Open Nearby and allow location to see mapped stops ranked by distance.";
    return "I couldn't find a matching stop in the imported timetable database for that place. Try a station's full name or use Nearby to search mapped stops around a selected locality.";
  }
  if (/alert|delay|disruption|service update/i.test(q)) {
    return alerts.length
      ? "Imported service alerts: " + alerts.slice(0, 5).map(a => a.title + " — " + a.description + " (source: " + (a.source_name || "not specified") + ")").join("; ")
      : "No verified operator service alerts are currently loaded in MUMOVE. Check the operator's official updates before travelling.";
  }
  if (/fare|cost|cheap|price|₹|rupee/i.test(q)) return "MUMOVE shows a fare only when a connected source publishes a usable fare rule for that service. I don't have a verified fare for this query, so I won't guess.";
  if (/train|local|rail|csmt/i.test(q)) return "MUMOVE currently has railway corridor reference information, but no verified Central, Western or Harbour machine-readable timetable or live train feed is connected.";
  if (/metro/i.test(q)) return "MUMOVE currently has metro corridor reference information, but no verified machine-readable metro timetable or live arrival feed is connected.";
  if (stopMatches.length) return "Matching MUMOVE stops: " + stopMatches.slice(0, 8).map(x => x.name + " (" + modeLabel(x.stop_type) + ")").join(", ") + ". Ask about a locality or a specific origin and destination.";
  return "I'm the free, database-grounded MUMOVE assistant. I can search imported stops and explain current timetable coverage. Try asking for bus stops near Bandra, a journey between two stops, live arrivals, fares, local trains or metro. I won't invent departures or fares.";
}

export default async function handler(req, res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history = [] } = req.body || {};
  if (typeof message !== "string" || !message.trim() || message.length > 1200) {
    return res.status(400).json({ error: "Enter a question (maximum 1,200 characters)." });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  let stopMatches = [];
  let alerts = [];
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const journey = message.match(/(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\?|$)/i);
    if (journey) {
      const [fromHits, toHits] = await Promise.all([
        searchStops(db, clean(journey[1])),
        searchStops(db, clean(journey[2]))
      ]);
      stopMatches = [...fromHits.map(x => ({ ...x, _query: "from" })), ...toHits.map(x => ({ ...x, _query: "to" }))];
    } else {
      const term = extractPlace(message);
      stopMatches = await searchStops(db, term, 8);
      if (!stopMatches.length && /bandr/i.test(term)) stopMatches = await searchStops(db, "Bandra", 8);
      if (/\bbus\b/i.test(message)) stopMatches = stopMatches.filter(x => x.stop_type === "bus_stop");
    }
    const { data, error } = await db.from("transport_service_alerts")
      .select("title,description,severity,source_name,source_updated_at")
      .eq("status", "active").limit(8);
    if (error) console.error("MUMOVE alert lookup failed:", error.message);
    alerts = data || [];
  }

  const providerKey = process.env.MUMOVE_OPENAI_API_KEY;
  if (!providerKey) return res.status(200).json({ reply: groundedReply(message, stopMatches, alerts), mode: "free-data-assistant" });

  const context = "Matching static database stops: " + JSON.stringify(stopMatches.map(x => ({ name: x.name, mode: x.stop_type, operator: x.operator_id }))) +
    "\nImported alerts: " + JSON.stringify(alerts) +
    "\nNo authorised live vehicle or train-position feed is connected.";
  const prior = Array.isArray(history)
    ? history.filter(x => ["user", "assistant"].includes(x.role) && typeof x.content === "string").slice(-8).map(x => ({ role: x.role, content: x.content.slice(0, 1000) }))
    : [];
  const response = await fetch(process.env.MUMOVE_AI_ENDPOINT || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + providerKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.MUMOVE_AI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are MUMOVE, a careful Mumbai public-transport assistant. Use only supplied database context for actual stops, schedules, fares and alerts. Clearly distinguish static schedules from real-time data. No authorised live bus, local train or metro vehicle feed is connected. Never invent departures, fares, platforms or positions. If context lacks data, say so.\n" + context },
        ...prior,
        { role: "user", content: message.trim() }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) return res.status(502).json({ error: data?.error?.message || "AI provider request failed." });
  return res.status(200).json({ reply: data.choices?.[0]?.message?.content || "I couldn't prepare an answer. Please try again.", mode: "hosted-ai" });
}
