import React,{useEffect,useState} from "react";
import {ArrowRight,Bus,Train,MapPin,Navigation,Search,Clock3,Wallet,RefreshCw} from "lucide-react";
import {hasSupabase,supabase} from "./supabase";
import AITravelAssistant from "./AITravelAssistant.jsx";
const modeName={bus:"Bus",suburban_rail:"Local train",metro:"Metro",ferry:"Ferry",other:"Transit"};
function StopPicker({label,value,onChange,onSelect,placeholder}){
 const [hits,setHits]=useState([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false);
 useEffect(()=>{if(value?.id||value.trim().length<2){setHits([]);return}const timer=setTimeout(async()=>{if(!hasSupabase)return;setLoading(true);const {data}=await supabase.rpc("mumove_search_stops",{search_term:value.trim(),result_limit:8});setHits(data||[]);setOpen(true);setLoading(false)},250);return()=>clearTimeout(timer)},[value]);
 return <div className="stop-picker"><label>{label}</label><div className="planner-input"><MapPin size={17}/><input value={value?.name||value} onChange={e=>onChange(e.target.value)} onFocus={()=>setOpen(true)} placeholder={placeholder}/>{loading&&<RefreshCw size={15} className="spin"/>}</div>{open&&hits.length>0&&<div className="stop-suggestions">{hits.map(s=><button type="button" key={s.id} onClick={()=>{onSelect(s);setOpen(false)}}><b>{s.name}</b><small>{modeName[s.stop_type==="bus_stop"?"bus":s.stop_type==="rail_station"?"suburban_rail":s.stop_type==="metro_station"?"metro":"other"]} · {s.operator_id}</small></button>)}</div>}</div>
}
function estimateFare(fareRows){return fareRows?.length?"₹"+Math.min(...fareRows.map(x=>Number(x.price))).toFixed(2):"Not published in feed"}
export default function JourneyPlanner(){
 const [from,setFrom]=useState(""),[to,setTo]=useState(""),[origin,setOrigin]=useState(null),[dest,setDest]=useState(null),[journeys,setJourneys]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[dataInfo,setDataInfo]=useState("");
 async function plan(){
  if(!hasSupabase){setError("Connect the MUMOVE Supabase project to search imported routes.");return}
  if(!origin||!dest){setError("Choose both origin and destination from the database suggestions.");return}
  setBusy(true);setError("");setJourneys([]);
  try{
   const [a,b]=await Promise.all([
    supabase.from("transport_route_stops").select("route_id,stop_sequence,transport_routes!inner(id,operator_id,route_short_name,route_long_name,mode)").eq("stop_id",origin.id).limit(500),
    supabase.from("transport_route_stops").select("route_id,stop_sequence,transport_routes!inner(id,operator_id,route_short_name,route_long_name,mode)").eq("stop_id",dest.id).limit(500)
   ]);
   if(a.error||b.error)throw new Error(a.error?.message||b.error?.message);
   const starts=a.data||[],ends=b.data||[],endByRoute=new Map(ends.map(x=>[x.route_id,x]));
   const direct=starts.filter(x=>endByRoute.has(x.route_id)&&endByRoute.get(x.route_id).stop_sequence>x.stop_sequence).map(x=>({legs:[{route:x.transport_routes,from:origin.name,to:dest.name,stops:endByRoute.get(x.route_id).stop_sequence-x.stop_sequence}],transfers:0}));
   const startRouteIds=[...new Set(starts.map(x=>x.route_id))],endRouteIds=[...new Set(ends.map(x=>x.route_id))];
   const [startStops,endStops]=await Promise.all([
    startRouteIds.length?supabase.from("transport_route_stops").select("route_id,stop_id,stop_sequence,transport_stops!inner(id,name)").in("route_id",startRouteIds).limit(3000):Promise.resolve({data:[]}),
    endRouteIds.length?supabase.from("transport_route_stops").select("route_id,stop_id,stop_sequence,transport_stops!inner(id,name)").in("route_id",endRouteIds).limit(3000):Promise.resolve({data:[]})
   ]);
   const endStopsById=new Map();for(const x of endStops.data||[]){if(!endStopsById.has(x.stop_id))endStopsById.set(x.stop_id,[]);endStopsById.get(x.stop_id).push(x)}
   const transfers=[];
   for(const s of startStops.data||[]){if(s.stop_sequence<= (starts.find(x=>x.route_id===s.route_id)?.stop_sequence||0))continue;for(const e of endStopsById.get(s.stop_id)||[]){const endOrigin=ends.find(x=>x.route_id===e.route_id);if(e.route_id!==s.route_id&&endOrigin&&e.stop_sequence<endOrigin.stop_sequence){const first=starts.find(x=>x.route_id===s.route_id)?.transport_routes;const second=ends.find(x=>x.route_id===e.route_id)?.transport_routes;if(first&&second)transfers.push({legs:[{route:first,from:origin.name,to:s.transport_stops.name,stops:s.stop_sequence-(starts.find(x=>x.route_id===s.route_id)?.stop_sequence||0)},{route:second,from:s.transport_stops.name,to:dest.name,stops:endOrigin.stop_sequence-e.stop_sequence}],transfers:1})}}}
   const all=[...direct,...transfers].sort((x,y)=>x.transfers-y.transfers||x.legs.reduce((n,l)=>n+l.stops,0)-y.legs.reduce((n,l)=>n+l.stops,0)).slice(0,6);
   if(!all.length){setDataInfo("No matching imported route chain was found. This does not prove no service exists; the current feed may cover buses only.");}
   else{
    const routeIds=[...new Set(all.flatMap(j=>j.legs.map(l=>l.route.id)))];
    const fares=await supabase.from("transport_fare_rules").select("route_id,transport_fare_products!inner(price,currency)").in("route_id",routeIds).limit(100);
    const fareByRoute=new Map();for(const f of fares.data||[]){if(!fareByRoute.has(f.route_id))fareByRoute.set(f.route_id,[]);fareByRoute.get(f.route_id).push(f.transport_fare_products)}
    for(const j of all){j.minutes=j.legs.reduce((n,l)=>n+Math.max(4,l.stops*3),0)+(j.transfers?8:0);j.fare=j.legs.map(l=>estimateFare(fareByRoute.get(l.route.id))).join(" + ")}
    setJourneys(all);setDataInfo("Route paths use imported GTFS stop sequences. Duration is a rough planning estimate (3 min per stop + transfer buffer), not a published timetable or live ETA."); 
   }
  }catch(e){setError(e.message||"Could not calculate routes.")}finally{setBusy(false)}
 }
 return <><div className="panel planner-panel journey-planner"><div className="panel-heading"><div><b>Find a connected journey</b><small>Search real imported stops and route sequences</small></div><span className="status-tag">GTFS-backed</span></div>
 <StopPicker label="FROM" value={from} onChange={v=>{setFrom(v);setOrigin(null)}} onSelect={s=>{setOrigin(s);setFrom(s.name)}} placeholder="Search stop or station (e.g. Andheri)"/>
 <StopPicker label="TO" value={to} onChange={v=>{setTo(v);setDest(null)}} onSelect={s=>{setDest(s);setTo(s.name)}} placeholder="Search destination (e.g. Dadar)"/>
 <button className="button primary full" onClick={plan} disabled={busy||!origin||!dest}>{busy?<RefreshCw className="spin" size={16}/>:<Navigation size={16}/>} Find journeys</button>
 {error&&<div className="notice">{error}</div>}{dataInfo&&<div className="notice">{dataInfo}</div>}
 {journeys.map((j,i)=><article className="journey-result" key={i}><div className="journey-top"><b>{j.transfers===0?"Direct journey":"1 transfer"}</b><span><Clock3 size={14}/> ~{j.minutes} min</span></div>{j.legs.map((l,n)=><div className="journey-leg" key={n}><span className="row-icon">{l.route.mode==="bus"?<Bus size={18}/>:<Train size={18}/>}</span><div><b>{modeName[l.route.mode]} · {l.route.route_short_name||l.route.route_long_name}</b><small>{l.from} → {l.to}</small></div></div>)}<div className="journey-foot"><span><Wallet size={14}/> {j.fare}</span><small>Fare shown only when GTFS publishes it</small></div></article>)}
 {!journeys.length&&!dataInfo&&<div className="planner-note">Import the public Mumbai GTFS schedule first. Timetables, live arrivals and operator fares are shown only when the source publishes them.</div>}
 </div><AITravelAssistant/></>
}
