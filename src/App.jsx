import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Activity, ArrowUpRight, Bike, Check, ChevronDown, Clock3, CloudRain, MapPin, Menu, Plus, Radio, Search, ShieldCheck, TrainFront, Users, X } from "lucide-react";
import { hasSupabase, supabase } from "./lib/supabase";

const stations = [
  { name: "Bandra", line: "Western Line", lat: 19.0544, lng: 72.8402 },
  { name: "Khar Road", line: "Western Line", lat: 19.0697, lng: 72.8406 },
  { name: "Santacruz", line: "Western Line", lat: 19.0810, lng: 72.8416 },
  { name: "Andheri", line: "Western Line", lat: 19.1197, lng: 72.8468 },
  { name: "Dadar", line: "Western + Central", lat: 19.0178, lng: 72.8478 }
];
const categories = [
  { id: "train", label: "Train crowd", icon: TrainFront, options: ["Low", "Moderate", "Heavy", "Very heavy"] },
  { id: "auto", label: "Auto queue", icon: Bike, options: ["No queue", "Under 5 min", "5–15 min", "15+ min"] },
  { id: "waterlogging", label: "Waterlogging", icon: CloudRain, options: ["Clear", "Minor", "Moderate", "Severe"] },
  { id: "station", label: "Station congestion", icon: Users, options: ["Low", "Moderate", "Heavy", "Very heavy"] }
];
const seed = [
  { id: "demo-1", station: "Bandra", category: "auto", level: "5–15 min", note: "Queue moving steadily", created_at: new Date(Date.now()-4*60000).toISOString(), confirmations: 3, demo: true },
  { id: "demo-2", station: "Andheri", category: "train", level: "Heavy", note: "Platform crowd reported by commuters", created_at: new Date(Date.now()-8*60000).toISOString(), confirmations: 5, demo: true },
  { id: "demo-3", station: "Dadar", category: "waterlogging", level: "Clear", note: "Approach road reported clear", created_at: new Date(Date.now()-12*60000).toISOString(), confirmations: 2, demo: true }
];
const age = date => {
  const mins = Math.max(0, Math.floor((Date.now()-new Date(date).getTime())/60000));
  return mins < 1 ? "Just now" : `${mins} min ago`;
};
const statusClass = value => /heavy|severe|15\+|moderate/i.test(value) ? "warn" : /clear|low|no queue|under 5/i.test(value) ? "good" : "mid";

export default function App() {
  const [reports, setReports] = useState(() => JSON.parse(localStorage.getItem("mumove-reports") || "null") || seed);
  const [station, setStation] = useState("Bandra");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState({ category: "train", level: "Moderate", note: "" });
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("All updates");

  useEffect(() => { localStorage.setItem("mumove-reports", JSON.stringify(reports)); }, [reports]);
  useEffect(() => {
    if (!hasSupabase) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("reports").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100);
      if (!error && alive && data?.length) setReports(data);
    };
    load();
    const channel = supabase.channel("reports-live").on("postgres_changes", { event: "*", schema: "public", table: "reports" }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  const visible = useMemo(() => reports.filter(r => (filter === "All updates" || r.category === filter) && (!query || r.station.toLowerCase().includes(query.toLowerCase()))), [reports, filter, query]);
  const currentStation = stations.find(s => s.name === station) || stations[0];
  const latestFor = category => reports.filter(r => r.station === station && r.category === category).sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0];

  async function submitReport(e) {
    e.preventDefault();
    const item = { station, category: form.category, level: form.level, note: form.note.trim(), created_at: new Date().toISOString(), confirmations: 0 };
    if (hasSupabase) {
      const { data, error } = await supabase.from("reports").insert({ ...item, expires_at: new Date(Date.now()+30*60000).toISOString() }).select().single();
      if (error) { setToast("Could not submit. Check database setup."); return; }
      setReports(prev => [data, ...prev]);
    } else {
      setReports(prev => [{ ...item, id: crypto.randomUUID(), demo: false }, ...prev]);
    }
    setModal(false); setForm({ category: "train", level: "Moderate", note: "" });
    setToast("Update shared with the community");
    setTimeout(() => setToast(""), 2600);
  }
  async function confirmReport(id) {
    const report = reports.find(r => r.id === id);
    if (!report) return;
    if (hasSupabase && !report.demo) {
      const { error } = await supabase.from("reports").update({ confirmations: (report.confirmations || 0) + 1 }).eq("id", id);
      if (error) { setToast("Confirmation unavailable right now"); return; }
    }
    setReports(prev => prev.map(r => r.id === id ? { ...r, confirmations: (r.confirmations || 0)+1 } : r));
    setToast("Thanks for confirming"); setTimeout(() => setToast(""), 2000);
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Activity size={19}/></span><span>MUMOVE<span className="brand-dot">.</span><small>MUMBAI MOBILITY</small></span></a>
      <nav className={mobileMenu ? "nav open" : "nav"}><a className="active" href="#overview">Overview</a><a href="#map">Live map</a><a href="#reports">Community</a><a href="#about">About</a></nav>
      <div className="top-actions"><span className="live-pill"><i/> Community live</span><button className="report-btn" onClick={() => setModal(true)}><Plus size={16}/> Report update</button><button className="menu-btn" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu ? <X/> : <Menu/>}</button></div>
    </header>
    <main>
      <section className="hero" id="overview">
        <div className="hero-copy"><div className="eyebrow"><span/> COMMUNITY-POWERED CITY INTELLIGENCE</div><h1>Move through<br/><em>Mumbai smarter.</em></h1><p>Know what’s happening at your station before you get there. Real-time local updates, shared by the people on the ground.</p>
          <div className="hero-actions"><button className="primary-btn" onClick={() => document.getElementById("map").scrollIntoView({behavior:"smooth"})}>Explore live map <ArrowUpRight size={17}/></button><span className="trust"><ShieldCheck size={16}/> Community reported · Time-stamped</span></div>
        </div>
        <div className="hero-aside"><div className="aside-top"><span>THE CITY, RIGHT NOW</span><Radio size={17}/></div><div className="big-stat">{reports.length.toString().padStart(2,"0")}<small>community updates</small></div><div className="aside-bottom"><span><i className="green-dot"/> Updates refresh as commuters contribute</span><span>Western Line focus</span></div></div>
      </section>
      <section className="quick-strip">
        <div><span className="strip-icon"><TrainFront/></span><span><small>TRAIN CROWD</small><b>{latestFor("train")?.level || "Awaiting reports"}</b></span></div>
        <div><span className="strip-icon"><Bike/></span><span><small>AUTO QUEUE</small><b>{latestFor("auto")?.level || "Awaiting reports"}</b></span></div>
        <div><span className="strip-icon"><CloudRain/></span><span><small>ROAD CONDITIONS</small><b>{latestFor("waterlogging")?.level || "Awaiting reports"}</b></span></div>
        <div><span className="strip-icon"><Users/></span><span><small>STATION CROWD</small><b>{latestFor("station")?.level || "Awaiting reports"}</b></span></div>
      </section>
      <section className="map-section" id="map">
        <div className="section-heading"><div><div className="eyebrow">LIVE CITY PICTURE</div><h2>Explore the ground reality.</h2><p>Community-submitted conditions across selected Western Line stations.</p></div><div className="map-legend"><span><i className="legend-good"/> Clear</span><span><i className="legend-mid"/> Moderate</span><span><i className="legend-warn"/> Heavy / alert</span></div></div>
        <div className="map-layout">
          <div className="map-card"><MapContainer center={[19.075,72.843]} zoom={12} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{stations.map(s => {
            const rs = reports.filter(r => r.station === s.name).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
            const urgent = rs.some(r => statusClass(r.level)==="warn");
            return <CircleMarker key={s.name} center={[s.lat,s.lng]} radius={urgent?10:8} pathOptions={{color:urgent?"#d16b4d":"#2e7964",fillColor:urgent?"#d16b4d":"#2e7964",fillOpacity:.8,weight:2}} eventHandlers={{click:()=>setStation(s.name)}}><Popup><b>{s.name} Station</b><br/>{rs.length ? `${rs.length} recent community update(s)` : "No recent community updates"}<br/><button onClick={()=>setStation(s.name)}>View station</button></Popup></CircleMarker>;
          })}</MapContainer><div className="map-caption"><MapPin size={14}/> Mumbai · Western Railway pilot area <span>Map data © OpenStreetMap</span></div></div>
          <aside className="station-panel"><div className="panel-head"><div><small>SELECTED STATION</small><h3>{station}</h3><span>{currentStation.line}</span></div><ChevronDown size={18}/></div><div className="station-select">{stations.map(s=><button key={s.name} className={station===s.name?"selected":""} onClick={()=>setStation(s.name)}>{s.name}</button>)}</div>
            <div className="condition-list">{categories.map(c=>{const Icon=c.icon, r=latestFor(c.id);return <div className="condition-row" key={c.id}><span className="condition-icon"><Icon size={17}/></span><span className="condition-name">{c.label}<small>{r?age(r.created_at):"No recent report"}</small></span><span className={`status ${r?statusClass(r.level):"unknown"}`}>{r?.level || "—"}</span></div>})}</div>
            <button className="outline-btn full" onClick={()=>setModal(true)}><Plus size={16}/> Share station update</button>
            <p className="panel-note"><ShieldCheck size={14}/> Reports are community estimates, not official railway data.</p>
          </aside>
        </div>
      </section>
      <section className="community-section" id="reports">
        <div className="section-heading report-heading"><div><div className="eyebrow">FROM THE COMMUNITY</div><h2>What commuters are seeing.</h2><p>Recent reports, shared by people travelling right now.</p></div><button className="outline-btn" onClick={()=>setModal(true)}><Plus size={16}/> Add your update</button></div>
        <div className="report-tools"><div className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search station..."/></div><div className="filter-pills">{["All updates","train","auto","waterlogging","station"].map(f=><button key={f} className={filter===f?"chosen":""} onClick={()=>setFilter(f)}>{f==="All updates"?"All":categories.find(c=>c.id===f)?.label || f}</button>)}</div></div>
        <div className="report-grid">{visible.slice(0,6).map(r=>{const c=categories.find(x=>x.id===r.category)||categories[0], Icon=c.icon;return <article className="report-card" key={r.id}><div className="report-card-top"><span className="report-type"><Icon size={15}/>{c.label}</span><span className={`status ${statusClass(r.level)}`}>{r.level}</span></div><h3>{r.station} Station</h3><p>{r.note || "A commuter shared a live condition update."}</p><div className="report-card-foot"><span><Clock3 size={13}/>{age(r.created_at)}</span><button onClick={()=>confirmReport(r.id)}><Check size={14}/> Confirm · {r.confirmations||0}</button></div></article>})}{visible.length===0&&<div className="empty-state">No reports match this view yet. Be the first to share an update.</div>}</div>
      </section>
      <section className="cta-band" id="about"><div><div className="eyebrow">BETTER COMMUTES, TOGETHER</div><h2>You’re already on the ground.<br/><em>Your update can help someone.</em></h2></div><button className="light-btn" onClick={()=>setModal(true)}>Share a live update <ArrowUpRight size={17}/></button></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><Activity size={17}/></span><span>MUMOVE<span className="brand-dot">.</span><small>MUMBAI MOBILITY</small></span></a><span>Community-powered mobility intelligence.</span><span className="footer-right">Pilot concept · Mumbai, India</span></footer>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="report-modal" onSubmit={submitReport}><div className="modal-top"><div><div className="eyebrow">COMMUNITY CONTRIBUTION</div><h2>Share what you see.</h2></div><button type="button" className="close-btn" onClick={()=>setModal(false)}><X/></button></div><label>Station<select value={station} onChange={e=>setStation(e.target.value)}>{stations.map(s=><option key={s.name}>{s.name}</option>)}</select></label><label>What are you reporting?<select value={form.category} onChange={e=>setForm({...form,category:e.target.value,level:categories.find(c=>c.id===e.target.value).options[0]})}>{categories.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label><label>Current condition<select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}>{categories.find(c=>c.id===form.category).options.map(o=><option key={o}>{o}</option>)}</select></label><label>Extra detail <span className="optional">Optional</span><textarea maxLength="180" rows="3" placeholder="E.g. queue starts near the east exit..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><div className="privacy-hint"><ShieldCheck size={15}/> Don't include personal information or photographs of strangers.</div><button className="primary-btn submit-btn" type="submit">Submit community update <ArrowUpRight size={16}/></button></form></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
    <div className="dev-indicator">{hasSupabase?"LIVE DATABASE CONNECTED":"DEMO MODE · LOCAL DEVICE ONLY"}</div>
  </div>;
}