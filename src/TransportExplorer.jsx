import React,{useEffect,useMemo,useState} from "react";
import {supabase,hasSupabase} from "./lib/supabase";
import {Bus,TrainFront,Train,MapPin,Search,Navigation,Clock3,Radio,Sparkles,ArrowUpRight,RefreshCw,AlertTriangle} from "lucide-react";

const SOURCES=[
 {name:"Central Railway",detail:"Mumbai suburban timetable",url:"https://cr.indianrailways.gov.in/offerings/schemes-and-services/preview/1122",kind:"Official timetable"},
 {name:"Western Railway",detail:"Mumbai suburban timetable · latest published revision",url:"https://wr.indianrailways.gov.in/offerings/custom/Mumbai%20Suburban/preview/523",kind:"Official timetable"},
 {name:"BEST Undertaking",detail:"Operator information and passenger services",url:"https://www.bestundertaking.com/",kind:"Official operator"},
 {name:"BEST Prawas",detail:"Official bus ETA, route planning and bus tracking app",url:"https://play.google.com/store/apps/details?id=com.dimts.best.bestapplication",kind:"Official passenger app"},
 {name:"BEST community GTFS",detail:"Community-maintained BEST/TMT/KDMT routes and schedules · MIT-0",url:"https://github.com/croyla/mumbai-gtfs",kind:"Community dataset · not operator-endorsed"},
 {name:"BEST fare chart",detail:"BMC Year Book fare table · effective 9 May 2025",url:"https://portal.mcgm.gov.in/irj/go/km/docs/documents/HomePage%20Data/Whats%20New/English%20Year%20Book%202025%20Portal.pdf",kind:"Published fare reference"},
 {name:"Maharashtra auto & taxi tariffs",detail:"Transport Department tariff-card publication page",url:"https://transport.maharashtra.gov.in/Site/Common/ViewPdfList.aspx?Doctype=1d1f28f9-a4e5-4b09-ab8b-1d4576adca18",kind:"Official tariff-card source"},
 {name:"UTS mobile ticketing",detail:"Railway suburban ticketing and fare purchase",url:"https://www.utsonmobile.indianrail.gov.in/",kind:"Official ticketing portal"},
 {name:"MMRDA",detail:"Metro corridor notices and timetable publications",url:"https://www.mmrda.maharashtra.gov.in/",kind:"Official authority"},
 {name:"Mumbai Metro One",detail:"Line 1 operator information",url:"https://www.mumbaimetroone.com/",kind:"Official operator"},
 {name:"MMRCL",detail:"Aqua Line service information",url:"https://mmrcl.com/",kind:"Official operator"}
];
const kmBetween=(a,b)=>{const r=x=>x*Math.PI/180,d1=r(b.latitude-a.latitude),d2=r(b.longitude-a.longitude),x=Math.sin(d1/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(d2/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
const modeIcon=m=>m==="bus"?Bus:m==="metro"?Train:m==="suburban_rail"?TrainFront:Navigation;
const modeName=m=>m==="suburban_rail"?"Local train":m==="metro"?"Metro":m==="bus"?"Bus":m||"Transit";
export default function TransportExplorer(){
 const [operators,setOperators]=useState([]),[routes,setRoutes]=useState([]),[stops,setStops]=useState([]),[trips,setTrips]=useState([]),[alerts,setAlerts]=useState([]),[vehicles,setVehicles]=useState([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[lastUpdated,setLastUpdated]=useState(null);
 const [search,setSearch]=useState(""),[mode,setMode]=useState("all"),[nearby,setNearby]=useState([]),[locStatus,setLocStatus]=useState("Location permission is optional");
 const [origin,setOrigin]=useState(""),[destination,setDestination]=useState(""),[path,setPath]=useState([]),[routeMessage,setRouteMessage]=useState("");
 const [assistantQ,setAssistantQ]=useState(""),[assistantA,setAssistantA]=useState("Ask about routes, stops, schedules or the cheapest way to travel.");
 const [selectedRoute,setSelectedRoute]=useState("");
 const load=async()=>{
  if(!hasSupabase){setError("Connect Supabase to load verified transport records.");return;}
  setBusy(true);setError("");
  try{
   const [o,r,s,t,a,v]=await Promise.all([
    supabase.from("transport_operators").select("*").order("name"),
    supabase.from("transport_routes").select("*").eq("active",true).limit(3000),
    supabase.from("transport_stops").select("*").limit(8000),
    supabase.from("scheduled_trips").select("*").eq("is_current",true).limit(3000),
    supabase.from("transport_service_alerts").select("*").eq("status","active").lte("starts_at",new Date().toISOString()).order("starts_at",{ascending:false}).limit(30),
    supabase.from("transport_vehicle_positions").select("*").gte("recorded_at",new Date(Date.now()-180000).toISOString()).order("recorded_at",{ascending:false}).limit(200)
   ]);
   const failure=[o,r,s,t,a,v].find(x=>x.error);if(failure)throw failure.error;
   setOperators(o.data||[]);setRoutes(r.data||[]);setStops(s.data||[]);setTrips(t.data||[]);setAlerts(a.data||[]);setVehicles(v.data||[]);setLastUpdated(new Date());
  }catch(e){setError(e.message||"Transport data could not be loaded.");}
  finally{setBusy(false);}
 };
 useEffect(()=>{load();},[]);
 const filteredRoutes=useMemo(()=>routes.filter(r=>(mode==="all"||r.mode===mode)&&(!search||[r.route_short_name,r.route_long_name].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()))).slice(0,80),[routes,mode,search]);
 const nearbyStops=useMemo(()=>nearby,[nearby]);
 const findNearby=()=>{
  if(!navigator.geolocation){setLocStatus("Geolocation is not supported on this device.");return;}
  setLocStatus("Finding nearby stops…");
  navigator.geolocation.getCurrentPosition(pos=>{
   const p={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
   const result=stops.map(s=>({...s,distance:kmBetween(p,s)})).filter(s=>s.distance<=2).sort((a,b)=>a.distance-b.distance).slice(0,30);
   setNearby(result);setLocStatus(result.length?result.length+" database stops within 2 km": "No imported transport stops found within 2 km.");
  },()=>setLocStatus("Location permission was not granted."),{enableHighAccuracy:true,timeout:12000});
 };
 const plan=()=>{
  const start=stops.find(s=>s.id===origin),end=stops.find(s=>s.id===destination);
  if(!start||!end){setRouteMessage("Choose both stops from the loaded transport database.");return;}
  const matching=routes.filter(r=>mode==="all"||r.mode===mode);
  setPath([]);
  setRouteMessage("Checking route-stop connections…");
  // Build a stop-to-stop graph from the published route sequence records.
  const run=async()=>{
   const routeIds=matching.map(r=>r.id);if(!routeIds.length){setRouteMessage("No route records have been imported yet.");return;}
   const {data,error:e}=await supabase.from("transport_route_stops").select("route_id,stop_id,stop_sequence").in("route_id",routeIds).order("stop_sequence");
   if(e){setRouteMessage("Route network unavailable: "+e.message);return;}
   const groups={};(data||[]).forEach(x=>(groups[x.route_id]??=[]).push(x));
   const graph={};
   Object.entries(groups).forEach(([rid,seq])=>{for(let i=0;i<seq.length-1;i++){const a=seq[i].stop_id,b=seq[i+1].stop_id;(graph[a]??=[]).push({to:b,route:rid});(graph[b]??=[]).push({to:a,route:rid});}});
   const queue=[[start.id,[]]],seen=new Set([start.id]);let found=null;
   while(queue.length){const [node,legs]=queue.shift();if(node===end.id){found=legs;break;}for(const edge of graph[node]||[]){if(!seen.has(edge.to)){seen.add(edge.to);queue.push([edge.to,[...legs,edge]]);}}}
   if(!found){setRouteMessage("No connected route found in the currently imported data. Try another pair or check operator schedules.");return;}
   const segments=[];found.forEach(edge=>{const r=matching.find(x=>x.id===edge.route);const prev=segments[segments.length-1];if(prev&&prev.route.id===edge.route)prev.stops.push(edge.to);else segments.push({route:r,stops:[edge.to]});});
   setPath(segments);setRouteMessage("Found "+segments.length+" service segment(s). This is a network connection, not a confirmed departure or fare quote.");
  };run();
 };
 const ask=()=>{
  const q=assistantQ.trim();if(!q)return;
  const terms=q.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
  const matches=routes.filter(r=>terms.some(t=>(r.route_short_name+" "+r.route_long_name).toLowerCase().includes(t))).slice(0,5);
  const stopMatches=stops.filter(s=>terms.some(t=>s.name.toLowerCase().includes(t))).slice(0,5);
  if(/live|track|where.*bus|eta|arrival/.test(q.toLowerCase()))setAssistantA(vehicles.length?"There are "+vehicles.length+" verified vehicle-position record(s) newer than 3 minutes in the database. Open the live tracking section to inspect them.":"No authorised live vehicle-position feed is currently connected. For BEST bus ETAs and tracking, use the official BEST Prawas app.");
  else if(/fare|cost|cheap|₹|rupee/.test(q.toLowerCase()))setAssistantA("I won't invent an operator fare. MUMOVE currently has no verified fare table loaded for this journey. Check the operator's official fare/booking channel; fare-rule integration is a next data task.");
  else if(/train|local|rail/.test(q.toLowerCase()))setAssistantA("Mumbai local timetable sources: Central Railway and Western Railway official timetable pages are linked below. The database does not yet contain a verified, machine-readable suburban timetable, so confirm the latest schedule with the railway.");
  else if(/metro/.test(q.toLowerCase()))setAssistantA("Metro service notices and timetable publications are linked below through MMRDA, Mumbai Metro One and MMRCL. No authorised live arrival feed is connected yet.");
  else if(matches.length)setAssistantA("I found these matching transport routes in MUMOVE's imported database: "+matches.map(r=>(r.route_short_name?r.route_short_name+" · ":"")+r.route_long_name+" ("+modeName(r.mode)+")").join("; ")+". Timetable validity depends on the source calendar.");
  else if(stopMatches.length)setAssistantA("Matching stops: "+stopMatches.map(s=>s.name).join(", ")+". Choose them in the route connector to check whether imported routes connect them.");
  else setAssistantA("I can search the transport records currently loaded in MUMOVE, but there is not enough verified data to answer that yet. Try a route number, bus stop, station name, or ask about local trains, metro, live tracking or fares. This early assistant uses transparent route-data rules; a hosted LLM is not connected yet.");
 };
 const activeSources=SOURCES;
 return <section className="transport-hub" id="transport-data">
  <div className="transport-hub-head"><div><div className="eyebrow">MUMOVE DATA EXPLORER</div><h2>Transport information, with source transparency.</h2><p>Schedules, stops, alerts and vehicle positions appear only when records are loaded and their source is identified.</p></div><button className="outline-btn" onClick={load} disabled={busy}><RefreshCw size={15}/>{busy?"Refreshing…":"Refresh data"}</button></div>
  <div className="transport-metrics"><article><b>{operators.length}</b><span>Operators registered</span></article><article><b>{routes.length.toLocaleString("en-IN")}</b><span>Imported routes</span></article><article><b>{stops.length.toLocaleString("en-IN")}</b><span>Mapped stops</span></article><article><b>{trips.length.toLocaleString("en-IN")}</b><span>Schedule records</span></article><article><b>{vehicles.length}</b><span>Fresh live positions</span></article></div>
  {error&&<div className="transport-notice"><AlertTriangle size={16}/>{error}</div>}
  <div className="transport-columns">
   <div className="transport-panel"><div className="transport-panel-title"><div><div className="eyebrow">ROUTE CATALOGUE</div><h3>Search buses, trains and metro.</h3></div><span className="data-pill">{routes.length?"DATABASE":"NO FEED YET"}</span></div>
    <div className="transport-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Route number, line or destination"/></div>
    <div className="transport-tabs">{[{id:"all",label:"All"},{id:"bus",label:"Bus"},{id:"suburban_rail",label:"Local"},{id:"metro",label:"Metro"}].map(x=><button key={x.id} className={mode===x.id?"active":""} onClick={()=>setMode(x.id)}>{x.label}</button>)}</div>
    <div className="transport-list">{filteredRoutes.length?filteredRoutes.map(r=>{const Icon=modeIcon(r.mode);return <button className="transport-route-row" key={r.id} onClick={()=>setSelectedRoute(r.id)}><span className="transport-route-icon"><Icon size={17}/></span><span><b>{r.route_short_name?r.route_short_name+" · ":""}{r.route_long_name}</b><small>{modeName(r.mode)} · {r.operator_id} · {r.source_ref||"Source reference pending"}</small></span><ArrowUpRight size={15}/></button>;}):<div className="transport-empty">No route records are loaded for this mode yet. Operator references are listed below.</div>}</div>
    {selectedRoute&&<div className="transport-selected"><b>Selected route</b><span>{routes.find(r=>r.id===selectedRoute)?.route_long_name}</span><small>{trips.filter(t=>t.route_id===selectedRoute).length} schedule rows in database. Service calendar and current-day validity must be checked before relying on a departure.</small>{trips.filter(t=>t.route_id===selectedRoute).slice(0,8).map(t=><div className="transport-trip-time" key={t.id}><b>{t.departure_time}</b><span>{t.arrival_time||"Arrival not listed"}</span><small>{t.service_date||"Recurring calendar · verify operating day"}</small></div>)}</div>}
   </div>
   <div className="transport-panel"><div className="transport-panel-title"><div><div className="eyebrow">NEARBY STOPS</div><h3>Find a stop around you.</h3></div><Navigation size={18}/></div>
    <button className="primary-btn transport-location" onClick={findNearby}><MapPin size={15}/> Find stops near me</button><p className="transport-muted">{locStatus}</p>
    <div className="transport-list">{nearbyStops.length?nearbyStops.map(s=><div className="nearby-stop-row" key={s.id}><MapPin size={15}/><span><b>{s.name}</b><small>{s.stop_type.replaceAll("_"," ")} · {s.operator_id}</small></span><strong>{s.distance.toFixed(1)} km</strong></div>):<div className="transport-empty">Nearby database lookup uses imported, operator-linked stop records. The map's OpenStreetMap discovery remains available as a separate mapped-data layer.</div>}</div>
   </div>
  </div>
  <div className="transport-columns transport-lower">
   <div className="transport-panel"><div className="eyebrow">MULTI-OPERATOR CONNECTION</div><h3>Build a connected public-transport route.</h3><p className="transport-muted">Select stops from the loaded database. MUMOVE checks route-stop sequences and transfers; it will not invent a train or bus departure.</p>
    <div className="transport-selects"><label>From<select value={origin} onChange={e=>setOrigin(e.target.value)}><option value="">Choose starting stop</option>{stops.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=><option key={s.id} value={s.id}>{s.name} · {s.operator_id}</option>)}</select></label><label>To<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Choose destination</option>{stops.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=><option key={s.id} value={s.id}>{s.name} · {s.operator_id}</option>)}</select></label></div>
    <button className="primary-btn" onClick={plan}>Find connected route <ArrowUpRight size={15}/></button><p className="transport-muted">{routeMessage}</p>
    {path.map((seg,i)=><div className="transport-path-leg" key={i}><b>{i+1}. {seg.route?.route_short_name||seg.route?.route_long_name}</b><small>{modeName(seg.route?.mode)} · {seg.stops.length+1} stop sequence nodes</small></div>)}
   </div>
   <div className="transport-panel"><div className="eyebrow">SERVICE STATUS</div><h3>Alerts and live vehicle feed.</h3>
    <div className="transport-status-row"><Radio size={17}/><span><b>{vehicles.length?"Live positions available":"No authorised live feed connected"}</b><small>Only positions recorded within the last 3 minutes are requested.</small></span></div>
    <div className="transport-status-row"><AlertTriangle size={17}/><span><b>{alerts.length?alerts.length+" active alerts":"No verified alerts loaded"}</b><small>Community reports are kept separate from official operator alerts.</small></span></div>
    {alerts.slice(0,5).map(a=><div className="transport-alert" key={a.id}><b>{a.title}</b><small>{a.source_name} · {a.severity}</small><p>{a.description}</p></div>)}
    {vehicles.slice(0,5).map(v=><div className="transport-alert" key={v.id}><b>{v.operator_id} · {v.id}</b><small>Recorded {new Date(v.recorded_at).toLocaleTimeString()}</small></div>)}
   </div>
  </div>
  <div className="transport-columns transport-lower">
   <div className="transport-panel"><div className="eyebrow">JOURNEY COPILOT · EARLY PREVIEW</div><h3>Ask MUMOVE about your journey.</h3><p className="transport-muted">The current assistant searches imported transport records and gives source-aware guidance. A hosted generative AI model is not connected yet.</p><div className="transport-search"><Sparkles size={16}/><input value={assistantQ} onChange={e=>setAssistantQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="e.g. Is there a bus from Bandra to Dadar?"/></div><button className="outline-btn" onClick={ask}>Ask journey assistant <ArrowUpRight size={14}/></button><div className="assistant-answer">{assistantA}</div></div>
   <div className="transport-panel"><div className="eyebrow">VERIFIED DATA SOURCES</div><h3>Check the operator before travel.</h3><div className="source-links">{activeSources.map(s=><a href={s.url} key={s.name} target="_blank" rel="noreferrer"><span><b>{s.name}</b><small>{s.detail} · {s.kind}</small></span><ArrowUpRight size={14}/></a>)}</div><p className="transport-muted">Official source links are not the same as an API integration. Live ETAs, fares and ticketing require operator-authorised feeds or partnerships.</p></div>
  </div>
  <div className="transport-footnote"><Clock3 size={14}/> {lastUpdated?"Database checked "+lastUpdated.toLocaleTimeString():"Database not checked yet"} · Scheduled data, live data and community reports are intentionally kept distinct.</div>
 </section>;
}
