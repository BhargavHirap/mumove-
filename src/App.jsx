import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { Activity, ArrowRightLeft, ArrowUpRight, Bike, Bus, CarFront, Check, ChevronDown, Clock3, CloudRain, Compass, LocateFixed, MapPin, Menu, Plus, Radio, Search, ShieldCheck, TrainFront, Users, X, Plane, Train, Navigation, Zap, Footprints, Sparkles } from "lucide-react";
import { hasSupabase, supabase } from "./lib/supabase";
import TransportExplorer from "./TransportExplorer.jsx";

const places = [
  { name: "Bandra Station", lat: 19.0544, lng: 72.8402 },
  { name: "Khar Road", lat: 19.0697, lng: 72.8406 },
  { name: "Santacruz Station", lat: 19.081, lng: 72.8416 },
  { name: "Andheri Station", lat: 19.1197, lng: 72.8468 },
  { name: "Dadar Station", lat: 19.0178, lng: 72.8478 },
  { name: "Chetana College", lat: 19.0549, lng: 72.8408 },
  { name: "Chhatrapati Shivaji Maharaj Terminus", lat: 18.9398, lng: 72.8355 },
  { name: "Mumbai Airport T2", lat: 19.099, lng: 72.874 },
  { name: "Juhu Beach", lat: 19.0988, lng: 72.8267 },
  { name: "Powai", lat: 19.1176, lng: 72.906 }
];
const stations = places.slice(0,5).map((p,i)=>({...p,line:i===4?"Western + Central":"Western Line"}));
const metroCorridors = [
  {line:"Line 1 · Blue",route:"Versova — Andheri — Ghatkopar",status:"Operating corridor",stations:"12 stations",operator:"Mumbai Metro One"},
  {line:"Line 2A · Yellow",route:"Dahisar East — Andheri West",status:"Operating corridor",stations:"17 stations",operator:"MMMOCL"},
  {line:"Line 3 · Aqua",route:"Cuffe Parade — BKC — Aarey JVLR",status:"Operating corridor",stations:"Underground corridor",operator:"MMRCL"},
  {line:"Line 7 · Red",route:"Dahisar East — Andheri East",status:"Operating corridor",stations:"13 stations",operator:"MMMOCL"},
  {line:"Line 2B",route:"DN Nagar — Mandale",status:"Phased corridor · verify opened section",stations:"Phase-wise opening",operator:"MMMOCL"},
  {line:"Line 9",route:"Dahisar East — Mira-Bhayandar",status:"Phased corridor · verify opened section",stations:"Phase-wise opening",operator:"MMMOCL"}
];
const railCorridors = [
  {name:"Western Line",route:"Churchgate — Virar",hubs:"Churchgate · Dadar · Bandra · Andheri · Borivali · Virar"},
  {name:"Central Line",route:"CSMT — Kalyan / Kasara / Khopoli",hubs:"CSMT · Byculla · Dadar · Kurla · Thane · Kalyan"},
  {name:"Harbour Line",route:"CSMT — Panvel / Goregaon",hubs:"CSMT · Wadala Road · Chembur · Vashi · Nerul · Panvel"}
];
const categories = [
  { id:"train", label:"Train crowd", icon:TrainFront, options:["Low","Moderate","Heavy","Very heavy"] },
  { id:"auto", label:"Auto queue", icon:Bike, options:["No queue","Under 5 min","5–15 min","15+ min"] },
  { id:"waterlogging", label:"Waterlogging", icon:CloudRain, options:["Clear","Minor","Moderate","Severe"] },
  { id:"station", label:"Station congestion", icon:Users, options:["Low","Moderate","Heavy","Very heavy"] }
];
const seed = [
  { id:"demo-1",station:"Bandra",category:"auto",level:"5–15 min",note:"Sample community update — verify locally",created_at:new Date(Date.now()-4*60000).toISOString(),confirmations:3,demo:true },
  { id:"demo-2",station:"Andheri",category:"train",level:"Heavy",note:"Sample community update — not an official feed",created_at:new Date(Date.now()-8*60000).toISOString(),confirmations:5,demo:true }
];
const age = date => { const m=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/60000)); return m<1?"Just now":`${m} min ago`; };
const statusClass = value => /heavy|severe|15\+/i.test(value) ? "warn" : /clear|low|no queue|under 5/i.test(value) ? "good" : "mid";
const distanceKm = (a,b) => { const r=x=>x*Math.PI/180, dLat=r(b.lat-a.lat),dLng=r(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2; return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); };
const money = n => "₹"+Math.max(0,Math.round(n));
const bestBusFare = km => { const slabs=[[5,10],[10,15],[15,20],[20,30],[25,35],[30,40],[35,45],[40,50],[45,55]]; const row=slabs.find(x=>km<=x[0]); return row?row[1]:null; };
const autoMeterFare = km => Math.round(km<=1.5?27:27+(km-1.5)*18.22);
const taxiMeterFare = km => Math.round(km<=1.5?33:33+(km-1.5)*21.90);
function MapFly({point}) { const map=useMap(); useEffect(()=>{if(point)map.flyTo([point.lat,point.lng],13,{duration:.8});},[point,map]); return null; }

export default function App() {
  const [reports,setReports]=useState(()=>JSON.parse(localStorage.getItem("mumove-reports")||"null")||seed);
  const [station,setStation]=useState("Bandra");
  const [query,setQuery]=useState("");
  const [modal,setModal]=useState(false);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [form,setForm]=useState({category:"train",level:"Moderate",note:""});
  const [toast,setToast]=useState("");
  const [filter,setFilter]=useState("All updates");
  const [origin,setOrigin]=useState("Bandra Station");
  const [destination,setDestination]=useState("Mumbai Airport T2");
  const [routeReady,setRouteReady]=useState(true);
  const [location,setLocation]=useState(null);
  const [locationState,setLocationState]=useState("Use my location");
  const [activeMode,setActiveMode]=useState("all");
  const [aiQuestion,setAiQuestion]=useState("");
  const [liveRoute,setLiveRoute]=useState(null);
  const [routeStatus,setRouteStatus]=useState("Calculating road route…");
  const [nearbyStops,setNearbyStops]=useState([]);
  const [nearbyStatus,setNearbyStatus]=useState("Find your location to discover nearby transport");
  const [weather,setWeather]=useState(null);
  const [weatherStatus,setWeatherStatus]=useState("Weather not loaded");

  useEffect(()=>{localStorage.setItem("mumove-reports",JSON.stringify(reports));},[reports]);
  useEffect(()=>{
    if(!hasSupabase)return;
    let alive=true;
    const load=async()=>{const {data,error}=await supabase.from("reports").select("*").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100);if(!error&&alive)setReports(data||[]);};
    load(); const channel=supabase.channel("reports-live").on("postgres_changes",{event:"*",schema:"public",table:"reports"},load).subscribe();
    return()=>{alive=false;supabase.removeChannel(channel);};
  },[]);

  const visible=useMemo(()=>reports.filter(r=>(filter==="All updates"||r.category===filter)&&(!query||r.station.toLowerCase().includes(query.toLowerCase()))),[reports,filter,query]);
  const currentStation=stations.find(s=>s.name.startsWith(station))||stations[0];
  const latestFor=category=>reports.filter(r=>r.station===station&&r.category===category).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
  const from=origin==="My location"&&location?location:(places.find(p=>p.name===origin)||places[0]), to=places.find(p=>p.name===destination)||places[7];
  const km=liveRoute?.distanceKm ?? distanceKm(from,to)*1.22;
  useEffect(()=>{
    let cancelled=false;
    const loadRoute=async()=>{
      setRouteStatus("Checking road route…");
      try{
        const url="https://router.project-osrm.org/route/v1/driving/"+from.lng+","+from.lat+";"+to.lng+","+to.lat+"?overview=false&alternatives=true&steps=false";
        const response=await fetch(url); if(!response.ok)throw new Error("Routing service unavailable");
        const json=await response.json(); if(!json.routes?.length)throw new Error("No road route found");
        if(!cancelled){const r=json.routes[0];setLiveRoute({distanceKm:r.distance/1000,durationMin:Math.round(r.duration/60)});setRouteStatus("Road route calculated · OSRM");}
      }catch{if(!cancelled){setLiveRoute(null);setRouteStatus("Using straight-line distance estimate");}}
    };
    loadRoute(); return()=>{cancelled=true;};
  },[from.lat,from.lng,to.lat,to.lng]);
  useEffect(()=>{
    if(!location)return;
    let cancelled=false;
    const loadNearby=async()=>{
      setNearbyStatus("Searching nearby public transport…");
      const q="[out:json][timeout:20];(node(around:1200,"+location.lat+","+location.lng+")[public_transport];way(around:1200,"+location.lat+","+location.lng+")[public_transport];node(around:1200,"+location.lat+","+location.lng+")[highway=bus_stop];node(around:1200,"+location.lat+","+location.lng+")[railway=station];);out center tags;";
      try{const res=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:"data="+encodeURIComponent(q)});if(!res.ok)throw new Error("Nearby data unavailable");const data=await res.json();const items=(data.elements||[]).map(x=>({id:x.id,name:x.tags?.name||x.tags?.["name:en"]||x.tags?.highway||x.tags?.railway||"Transport stop",type:x.tags?.railway==="station"?"Rail station":x.tags?.highway==="bus_stop"?"Bus stop":x.tags?.public_transport==="platform"?"Transit platform":"Public transport",lat:x.lat??x.center?.lat,lng:x.lon??x.center?.lon})).filter(x=>x.lat&&x.lng).slice(0,18);if(!cancelled){setNearbyStops(items);setNearbyStatus(items.length?items.length+" mapped stops and stations found within 1.2 km · OpenStreetMap":"No mapped stops found nearby");}}
      catch{if(!cancelled)setNearbyStatus("Nearby transport lookup temporarily unavailable");}
    };
    const loadWeather=async()=>{try{const res=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+location.lat+"&longitude="+location.lng+"&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto");if(!res.ok)throw new Error();const j=await res.json();if(!cancelled){setWeather(j.current);setWeatherStatus("Current conditions · Open-Meteo");}}catch{if(!cancelled)setWeatherStatus("Weather unavailable");}};
    loadNearby();loadWeather();return()=>{cancelled=true;};
  },[location?.lat,location?.lng]);
  const routes=[
    {id:"train",name:"Mumbai local train",detail:"Official fare via UTS · timetable source linked below",icon:TrainFront,fare:null,fareLabel:"Check UTS",time:liveRoute?.durationMin?Math.max(8,Math.round(liveRoute.durationMin+5)):Math.max(12,Math.round(km*3.2+10)),tag:"High-capacity rail"},
    {id:"metro",name:"Mumbai Metro",detail:"Operator fare depends on corridor and stations",icon:Train,fare:null,fareLabel:"Check operator",time:liveRoute?.durationMin?Math.max(8,Math.round(liveRoute.durationMin+8)):Math.max(15,Math.round(km*3.6+12)),tag:"Rapid transit"},
    {id:"bus",name:"BEST bus",detail:"Distance-slab estimate · adult non-AC fare chart",icon:Bus,fare:bestBusFare(km),fareLabel:bestBusFare(km)===null?"Check operator":null,time:liveRoute?.durationMin?Math.max(12,Math.round(liveRoute.durationMin*1.45+8)):Math.max(18,Math.round(km*5.2+12)),tag:"Low cost"},
    {id:"auto",name:"Auto rickshaw",detail:"Meter estimate · revised MMR tariff from Sep 2026",icon:Bike,fare:autoMeterFare(km),time:liveRoute?.durationMin?Math.max(8,Math.round(liveRoute.durationMin+4)):Math.max(10,Math.round(km*3.4+7)),tag:"Direct ride"},
    {id:"cab",name:"Kaali-peeli taxi",detail:"Meter estimate · revised MMR tariff from Sep 2026",icon:CarFront,fare:taxiMeterFare(km),time:liveRoute?.durationMin?Math.max(8,Math.round(liveRoute.durationMin)):Math.max(10,Math.round(km*3+8)),tag:"Metered taxi"}
  ];
  const shownRoutes=routes.filter(r=>activeMode==="all"||r.id===activeMode);
  function useMyLocation(){if(!navigator.geolocation){setLocationState("Location not supported");return;}setLocationState("Finding location…");navigator.geolocation.getCurrentPosition(pos=>{const p={lat:pos.coords.latitude,lng:pos.coords.longitude};setLocation(p);setOrigin("My location");setLocationState("Location found");},()=>setLocationState("Location permission needed"),{enableHighAccuracy:true,timeout:10000});}
  function swap(){setOrigin(destination);setDestination(origin);}
  function getRoute(){setRouteReady(true);setActiveMode("all");document.getElementById("route-results")?.scrollIntoView({behavior:"smooth",block:"nearest"});}
  async function submitReport(e){e.preventDefault();const item={station,category:form.category,level:form.level,note:form.note.trim(),created_at:new Date().toISOString(),confirmations:0};if(hasSupabase){const {data,error}=await supabase.from("reports").insert({...item,expires_at:new Date(Date.now()+30*60000).toISOString()}).select().single();if(error){setToast("Could not submit. Check database setup.");return;}setReports(prev=>[data,...prev]);}else setReports(prev=>[{...item,id:crypto.randomUUID(),demo:false},...prev]);setModal(false);setForm({category:"train",level:"Moderate",note:""});setToast("Update shared with the community");setTimeout(()=>setToast(""),2600);}
  async function confirmReport(id){const r=reports.find(x=>x.id===id);if(!r)return;if(hasSupabase&&!r.demo){const {error}=await supabase.from("reports").update({confirmations:(r.confirmations||0)+1}).eq("id",id);if(error){setToast("Confirmation unavailable right now");return;}}setReports(prev=>prev.map(x=>x.id===id?{...x,confirmations:(x.confirmations||0)+1}:x));setToast("Thanks for confirming");setTimeout(()=>setToast(""),2000);}

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><Activity size={19}/></span><span>MUMOVE<span className="brand-dot">.</span><small>MOBILITY INTELLIGENCE</small></span></a>
      <nav className={mobileMenu?"nav open":"nav"}><a className="active" href="#plan">Plan a journey</a><a href="#explore">Explore map</a><a href="#network">Transport network</a><a href="#reports">Community</a><a href="#vision">Our vision</a></nav>
      <div className="top-actions"><span className="city-pill"><MapPin size={13}/> Mumbai pilot</span><button className="report-btn" onClick={()=>setModal(true)}><Plus size={16}/> Report update</button><button className="menu-btn" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu?<X/>:<Menu/>}</button></div>
    </header>
    <main>
      <section className="hero" id="plan"><div className="hero-copy"><div className="eyebrow"><span/> YOUR CITY. CONNECTED.</div><h1>Every journey,<br/><em>one smarter move.</em></h1><p>Compare ways to get there. Understand your options. Move across the city with more confidence.</p><div className="hero-actions"><a className="primary-btn" href="#journey">Plan your journey <ArrowUpRight size={17}/></a><span className="trust"><ShieldCheck size={16}/> Clear estimates · Community insights</span></div></div>
      <div className="hero-aside"><div className="aside-top"><span>MUMOVE MOBILITY NETWORK</span><Activity size={17}/></div><div className="big-stat">01<small>city pilot · Mumbai</small></div><div className="aside-bottom"><span><i className="green-dot"/> Built for India, designed to scale globally</span><span>Public + private mobility</span></div></div></section>

      <section className="journey-section" id="journey"><div className="journey-intro"><div className="eyebrow">MULTI-MODAL JOURNEY PLANNER</div><h2>Where do you want to go?</h2><p>Compare indicative travel options across the city.</p></div>
        <div className="planner-card"><div className="place-fields"><label><span>FROM</span><div className="place-input"><span className="pin-dot start"></span><select value={origin} onChange={e=>setOrigin(e.target.value)}>{places.map(p=><option key={p.name}>{p.name}</option>)}{location&&<option>My location</option>}</select></div></label><button className="swap-btn" onClick={swap} aria-label="Swap locations"><ArrowRightLeft size={17}/></button><label><span>TO</span><div className="place-input"><span className="pin-dot end"></span><select value={destination} onChange={e=>setDestination(e.target.value)}>{places.map(p=><option key={p.name}>{p.name}</option>)}</select></div></label></div>
          <div className="planner-actions"><button className="location-btn" onClick={useMyLocation}><LocateFixed size={15}/>{locationState}</button><button className="primary-btn" onClick={getRoute}>Compare journeys <ArrowUpRight size={16}/></button></div>
          <div className="planner-disclaimer">Route distances and prices below are planning estimates, not operator quotes or live schedules.</div>
        </div>
      </section>

      <section className="results-section" id="route-results"><div className="section-heading"><div><div className="eyebrow">YOUR ROUTE OPTIONS</div><h2>{origin==="My location"?"Your location":origin} <span className="route-arrow">→</span> {destination}</h2><p>Approx. {km.toFixed(1)} km · {routeStatus} · compare before you leave</p></div><span className="estimate-chip">ESTIMATES ONLY</span></div>
        <div className="mode-filters">{[{id:"all",label:"All options"},{id:"train",label:"Train"},{id:"metro",label:"Metro"},{id:"bus",label:"Bus"},{id:"auto",label:"Auto"},{id:"cab",label:"Cab"}].map(m=><button key={m.id} className={activeMode===m.id?"chosen":""} onClick={()=>setActiveMode(m.id)}>{m.label}</button>)}</div>
        <div className="route-grid">{shownRoutes.map((r,i)=>{const Icon=r.icon;return <article className={"route-card "+(i===0?"recommended":"")} key={r.id}>{i===0&&activeMode==="all"&&<span className="recommend-label"><Sparkles size={12}/> LOWEST ESTIMATE</span>}<div className="route-icon"><Icon size={21}/></div><div className="route-title"><h3>{r.name}</h3><span>{r.detail}</span></div><div className="route-stats"><div><small>EST. FARE</small><b>{r.fare===null?(r.fareLabel||"Check operator"):money(r.fare)}</b></div><div><small>EST. TIME</small><b>{r.time} min</b></div></div><div className="route-foot"><span>{r.tag}</span><span className="not-live">Indicative · not live</span></div></article>;})}</div>
        <p className="fine-print">BEST bus fare uses the published adult non-AC distance slabs where route distance is available. Auto/taxi amounts are meter estimates using the revised MMR base and per-km rates; meter rounding, waiting, midnight surcharges and recalibration can change the amount. Rail/metro fares and all departure times must be checked with the operator. App-cab quotes and bookings are not connected.</p>
      </section>

      <section className="network-section" id="network"><div className="section-heading"><div><div className="eyebrow">MUMBAI TRANSPORT NETWORK</div><h2>Know the network before you move.</h2><p>Corridor reference for suburban rail and metro. Service disruptions and next-train arrivals are not connected yet.</p></div><span className="estimate-chip">NETWORK REFERENCE</span></div><div className="network-columns"><div className="network-panel"><div className="network-panel-head"><TrainFront size={19}/><div><b>Mumbai suburban railway</b><small>Three major commuter corridors</small></div></div>{railCorridors.map(line=><article className="network-row" key={line.name}><div><b>{line.name}</b><span>{line.route}</span><small>{line.hubs}</small></div><a href="https://www.indianrail.gov.in/" target="_blank" rel="noreferrer">Rail info ↗</a></article>)}</div><div className="network-panel"><div className="network-panel-head"><Train size={19}/><div><b>Mumbai Metro corridors</b><small>Published network overview · verify operator notices</small></div></div>{metroCorridors.map(line=><article className="network-row" key={line.line}><div><b>{line.line}</b><span>{line.route}</span><small>{line.operator} · {line.stations}</small></div><span className={line.status.includes("Phased")?"network-status partial":"network-status"}>{line.status}</span></article>)}</div></div><div className="bus-discovery"><div><Bus size={19}/><div><b>BEST and nearby bus stops</b><small>Mapped stop discovery uses OpenStreetMap near your shared location. It does not provide bus route numbers, arrivals or vehicle tracking.</small></div></div><span>{nearbyStops.filter(x=>x.type==="Bus stop").length} mapped bus stops found nearby</span></div><p className="fine-print">Transport network references are informational. MUMOVE does not currently provide official departure boards, disruption alerts, or ticket sales. Check operator channels before travel.</p></section>
      <TransportExplorer />

      <section className="feature-strip"><div><span><Train size={18}/></span><b>Rail & metro</b><small>Schedules and service data integration planned</small></div><div><span><Bus size={18}/></span><b>City buses</b><small>Routes, stops and operator feeds planned</small></div><div><span><Bike size={18}/></span><b>Auto & taxi</b><small>Fare intelligence and booking partners planned</small></div><div><span><Plane size={18}/></span><b>Travel beyond</b><small>Airport, intercity and global expansion</small></div></section>

      <section className="live-data-strip"><div className="live-data-heading"><div className="eyebrow">LIVE CONTEXT</div><h2>Your surroundings, at a glance.</h2><p>Live weather and mapped transport discovery use public data sources. Stop locations are mapped data, not vehicle tracking.</p></div><div className="live-data-cards"><article><span className="live-data-icon"><CloudRain size={19}/></span><div><small>LOCAL WEATHER</small><b>{weather?Math.round(weather.temperature_2m)+"°C · "+weather.precipitation+" mm rain":"Waiting for location"}</b><em>{weatherStatus}</em></div></article><article><span className="live-data-icon"><Navigation size={19}/></span><div><small>NEARBY TRANSPORT</small><b>{nearbyStops.length?nearbyStops.length+" mapped places":"Location needed"}</b><em>{nearbyStatus}</em></div></article></div>{nearbyStops.length>0&&<div className="nearby-list">{nearbyStops.slice(0,8).map(stop=><span key={stop.id}><MapPin size={13}/><b>{stop.name}</b><small>{stop.type}</small></span>)}</div>}</section>
      <section className="map-section" id="explore"><div className="section-heading"><div><div className="eyebrow">MUMBAI PILOT AREA</div><h2>Explore the ground reality.</h2><p>Station locations and commuter-submitted conditions. Not an official live transit feed.</p></div><div className="map-legend"><span><i className="legend-good"/> Clear</span><span><i className="legend-mid"/> Moderate</span><span><i className="legend-warn"/> Heavy / alert</span></div></div>
        <div className="map-layout"><div className="map-card"><MapContainer center={[19.075,72.843]} zoom={12} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{places.map(p=><CircleMarker key={p.name} center={[p.lat,p.lng]} radius={p.name===origin||p.name===destination?10:6} pathOptions={{color:p.name===origin?"#2e7964":"#c18a48",fillColor:p.name===origin?"#2e7964":"#c18a48",fillOpacity:.8,weight:2}}><Popup><b>{p.name}</b><br/>Mapped pilot location</Popup></CircleMarker>)}{location&&<CircleMarker center={[location.lat,location.lng]} radius={9} pathOptions={{color:"#3b76b7",fillColor:"#3b76b7",fillOpacity:.8}}><Popup>Your current location</Popup></CircleMarker>}</MapContainer><div className="map-caption"><MapPin size={14}/> Mumbai · Western suburbs pilot <span>Map data © OpenStreetMap</span></div></div>
          <aside className="station-panel"><div className="panel-head"><div><small>SELECTED STATION</small><h3>{station}</h3><span>{currentStation.line}</span></div><ChevronDown size={18}/></div><div className="station-select">{stations.map(s=><button key={s.name} className={station===s.name?"selected":""} onClick={()=>setStation(s.name.replace(" Station",""))}>{s.name.replace(" Station","")}</button>)}</div><div className="condition-list">{categories.map(c=>{const Icon=c.icon,r=latestFor(c.id);return <div className="condition-row" key={c.id}><span className="condition-icon"><Icon size={17}/></span><span className="condition-name">{c.label}<small>{r?age(r.created_at):"No recent report"}</small></span><span className={`status ${r?statusClass(r.level):"unknown"}`}>{r?.level||"—"}</span></div>;})}</div><button className="outline-btn full" onClick={()=>setModal(true)}><Plus size={16}/> Share station update</button><p className="panel-note"><ShieldCheck size={14}/> Community reports are not official railway data.</p></aside></div>
      </section>

      <section className="community-section" id="reports"><div className="section-heading report-heading"><div><div className="eyebrow">FROM THE COMMUNITY</div><h2>What commuters are seeing.</h2><p>Community reports help other people make informed choices.</p></div><button className="outline-btn" onClick={()=>setModal(true)}><Plus size={16}/> Add your update</button></div><div className="report-tools"><div className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search station..."/></div><div className="filter-pills">{["All updates","train","auto","waterlogging","station"].map(f=><button key={f} className={filter===f?"chosen":""} onClick={()=>setFilter(f)}>{f==="All updates"?"All":categories.find(c=>c.id===f)?.label||f}</button>)}</div></div><div className="report-grid">{visible.slice(0,6).map(r=>{const c=categories.find(x=>x.id===r.category)||categories[0],Icon=c.icon;return <article className="report-card" key={r.id}><div className="report-card-top"><span className="report-type"><Icon size={15}/>{c.label}</span><span className={`status ${statusClass(r.level)}`}>{r.level}</span></div><h3>{r.station} Station</h3><p>{r.note||"A commuter shared a condition update."}</p><div className="report-card-foot"><span><Clock3 size={13}/>{age(r.created_at)}</span><button onClick={()=>confirmReport(r.id)}><Check size={14}/> Confirm · {r.confirmations||0}</button></div></article>;})}{visible.length===0&&<div className="empty-state">No reports match this view yet. Be the first to share an update.</div>}</div></section>

      <section className="ai-band" id="vision"><div className="ai-symbol"><Sparkles size={24}/></div><div><div className="eyebrow">THE BIGGER VISION</div><h2>Meet MUMOVE AI.</h2><p>Ask for the cheapest route, a simpler transfer or a plan that fits your time and budget. AI trip assistance is on our roadmap — live operator connections will power reliable answers.</p></div><div className="ai-example"><span>COMING NEXT</span><b>“I have ₹100. What's the best way to reach Dadar?”</b><small>Voice · regional languages · smart alternatives</small></div></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><Activity size={17}/></span><span>MUMOVE<span className="brand-dot">.</span><small>MOBILITY INTELLIGENCE</small></span></a><span>One platform. Every journey.</span><span className="footer-right">Mumbai-first · Global by design</span></footer>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="report-modal" onSubmit={submitReport}><div className="modal-top"><div><div className="eyebrow">COMMUNITY CONTRIBUTION</div><h2>Share what you see.</h2></div><button type="button" className="close-btn" onClick={()=>setModal(false)}><X/></button></div><label>Station<select value={station} onChange={e=>setStation(e.target.value)}>{stations.map(s=><option key={s.name} value={s.name.replace(" Station","")}>{s.name}</option>)}</select></label><label>What are you reporting?<select value={form.category} onChange={e=>setForm({...form,category:e.target.value,level:categories.find(c=>c.id===e.target.value).options[0]})}>{categories.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label><label>Current condition<select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}>{categories.find(c=>c.id===form.category).options.map(o=><option key={o}>{o}</option>)}</select></label><label>Extra detail <span className="optional">Optional</span><textarea maxLength="180" rows="3" placeholder="E.g. queue starts near the east exit..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><div className="privacy-hint"><ShieldCheck size={15}/> Don't include personal information or photographs of strangers.</div><button className="primary-btn submit-btn" type="submit">Submit community update <ArrowUpRight size={16}/></button></form></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
    <div className="dev-indicator">{hasSupabase?"COMMUNITY DATABASE CONNECTED":"COMMUNITY DEMO · LOCAL DEVICE"}</div>
  </div>;
}
