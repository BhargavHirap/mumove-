import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const clean = value => String(value || "").trim().replace(/[?!.,]+$/g, "");
const modeLabel = value => value === "bus_stop" ? "bus stop" : value === "rail_station" ? "rail station" : value === "metro_station" ? "metro station" : "transport stop";

async function searchStops(db, term) {
  if (!term) return [];
  const { data, error } = await db.rpc("mumove_search_stops", {
    search_term: term,
    result_limit: 6
  });
  if (error) return [];
  return data || [];
}

function groundedReply(message, stopMatches, alerts) {
  const q = message.toLowerCase();
  const journey = q.match(/(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\?|$)/i);
  if (journey) {
    const from = clean(journey[1]);
    const to = clean(journey[2]);
    const fromHits = stopMatches.filter(x => x._query === "from");
    const toHits = stopMatches.filter(x => x._query === "to");
    const format = rows => rows.slice(0, 3).map(x => x.name + " (" + modeLabel(x.stop_type) + ")").join(", ");
    if (!fromHits.length || !toHits.length) {
      return "I couldn't match both places to the currently imported MUMOVE transport stops. I searched for " + from + " and " + to + ". Try selecting the exact stop suggestions in Plan. The imported community GTFS feed currently covers bus schedules only; local railway and metro timetables are not yet connected, so I won't invent a complete Andheri–CSMT itinerary.";
    }
    return "MUMOVE found these matching origin stops near " + from + ": " + format(fromHits) + ". Destination matches near " + to + ": " + format(toHits) + ". These records come from the imported community bus dataset. I can't confirm a complete journey, departure time or fare from these matches alone. Use Plan to check GTFS-connected bus trips; railway and metro route data still need authorised timetable imports.";
  }
  if (/near|nearby|stop|station|bandr|bandra/i.test(q)) {
    const rows = stopMatches.filter(x => !x._query);
    if (rows.length) return "MUMOVE found these matching mapped stops: " + rows.slice(0, 8).map(x => x.name + " (" + modeLabel(x.stop_type) + (x.operator_id ? ", " + x.operator_id.toUpperCase() : "") + ")").join("; ") + ". These are database matches, not a GPS-based distance ranking. Open Nearby and allow location for distance-based results.";
    return "I couldn't find a matching stop in the currently imported database. Open Nearby and allow location, or search the exact locality/station name. The public map layer may show mapped places even when they aren't in the timetable feed.";
  }
  if (/alert|delay|disruption|service update/i.test(q)) {
    return alerts.length
      ? "Current imported service alerts: " + alerts.slice(0, 5).map(a => a.title + " — " + a.description + " (source: " + (a.source_name || "not specified") + ")").join("; ")
      : "No verified operator service alerts are currently loaded in MUMOVE. Check the relevant operator's official updates before travelling.";
  }
  if (/live|track|eta|arrival|where.*bus/i.test(q)) {
    return "MUMOVE does not currently have an authorised live vehicle-position feed connected. The imported GTFS data is a static schedule, not live tracking. For BEST live bus ETAs, use the official BEST passenger app; railway and metro live arrivals are not yet integrated.";
  }
  if (/fare|cost|cheap|price|₹|rupee/i.test(q)) {
    return "MUMOVE will show a fare only when a connected source publishes a usable fare rule. I don't have a verified fare for this query, so I won't guess. Check the relevant operator's official fare or ticketing channel.";
  }
  if (/train|local|rail|csmt/i.test(q)) {
    return "Mumbai local railway route information is shown as a reference in MUMOVE, but a verified machine-readable Central/Western/Harbour timetable is not yet imported. Check the latest railway timetable before boarding. The current community GTFS import covers BEST/TMT/KDMT bus schedules only.";
  }
  if (/metro/i.test(q)) {
    return "MUMOVE currently lists Mumbai Metro corridors as reference information, but authorised machine-readable metro timetables and live arrivals are not connected yet. Check the relevant metro operator's current service notices.";
  }
  if (stopMatches.length) {
    return "Here are matching MUMOVE database stops: " + stopMatches.slice(0, 8).map(x => x.name + " (" + modeLabel(x.stop_type) + ")").join(", ") + ". Ask about a specific origin and destination to check what the imported data can support.";
  }
  return "I'm the free, database-grounded MUMOVE assistant. I can search imported stops and explain the current transport-data coverage. Try asking for stops near a locality, a bus route, live tracking, fares, local trains or metro. I won't invent departures or fares.";
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
  let db = null;
  let stopMatches = [];
  let alerts = [];

  if (url && key) {
    db = createClient(url, key, { auth: { persistSession: false } });
    const journey = message.match(/(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\?|$)/i);
    if (journey) {
      const [fromHits, toHits] = await Promise.all([
        searchStops(db, clean(journey[1])),
        searchStops(db, clean(journey[2]))
      ]);
      stopMatches = [
        ...fromHits.map(x => ({ ...x, _query: "from" })),
        ...toHits.map(x => ({ ...x, _query: "to" }))
      ];
    } else {
      const term = message.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().split(/\s+/).filter(x => x.length > 2).slice(0, 3).join(" ");
      stopMatches = await searchStops(db, term);
      // Help with common partial spelling such as "Bandr".
      if (!stopMatches.length && /bandr/i.test(term)) stopMatches = await searchStops(db, "Bandra");
    }
    const { data } = await db.from("transport_service_alerts")
      .select("title,description,severity,source_name,source_updated_at")
      .eq("status", "active").limit(8);
    alerts = data || [];
  }

  const providerKey = process.env.MUMOVE_OPENAI_API_KEY;
  if (!providerKey) {
    return res.status(200).json({
      reply: groundedReply(message, stopMatches, alerts),
      mode: "free-data-assistant"
    });
  }

  let context = "No verified timetable, fare or live vehicle data is currently connected.";
  if (stopMatches.length) context = "Matching database stops (static records): " + JSON.stringify(stopMatches.map(x => ({ name: x.name, mode: x.stop_type, operator: x.operator_id })));
  if (alerts.length) context += "\nCurrent imported service alerts: " + JSON.stringify(alerts);
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
        { role: "system", content: "You are MUMOVE, a careful Mumbai public-transport travel assistant. Use only supplied database context for claims about actual stops, schedules, fares, service alerts or live positions. Clearly distinguish static schedules from real-time data. Never invent departures, fares, platforms or vehicle positions. If context lacks data, say so. Database context:\n" + context },
        ...prior,
        { role: "user", content: message.trim() }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) return res.status(502).json({ error: data?.error?.message || "AI provider request failed." });
  return res.status(200).json({ reply: data.choices?.[0]?.message?.content || "I couldn't prepare an answer. Please try again.", mode: "hosted-ai" });
}
