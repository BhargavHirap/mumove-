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
  setBusy(true);setError("");setJourneys([]);setDataInfo("");
  try{
   const [a,b]=await Promise.all([
    supabase.from("trip_stop_times").select("trip_id,stop_sequence,scheduled_trips!inner(route_id,departure_time,arrival_time)").eq("stop_id",origin.id).limit(300),
    supabase.from("trip_stop_times").select("trip_id,stop_sequence,scheduled_trips!inner(route_id,departure_time,arrival_time)").eq("stop_id",dest.id).limit(300)
   ]);
   if(a.error||b.error)throw new Error(a.error?.message||b.error?.message);
   const starts=a.data||[],ends=b.data||[],endByTrip=new Map(ends.map(x=>[x.trip_id,x]));
   const direct=starts.filter(x=>endByTrip.has(x.trip_id)&&endByTrip.get(x.trip_id).stop_sequence>x.stop_sequence).map(x=>({
    legs:[{routeId:x.scheduled_trips.route_id,tripId:x.trip_id,from:origin.name,to:dest.name,stops:endByTrip.get(x.trip_id).stop_sequence-x.stop_sequence}],transfers:0
   }));
   const startTripIds=[...new Set(starts.map(x=>x.trip_id))].slice(0,150);
   const endTripIds=[...new Set(ends.map(x=>x.trip_id))].slice(0,150);
   const [startPaths,endPaths]=await Promise.all([
    startTripIds.length?supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,transport_stops!inner(name)").in("trip_id",startTripIds).limit(12000):Promise.resolve({data:[]}),
    endTripIds.length?supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,transport_stops!inner(name)").in("trip_id",endTripIds).limit(12000):Promise.resolve({data:[]})
   ]);
   if(startPaths.error||endPaths.error)throw new Error(startPaths.error?.message||endPaths.error?.message);
   const startByTrip=new Map(starts.map(x=>[x.trip_id,x])),endByTripFull=new Map(ends.map(x=>[x.trip_id,x]));
   const endsByStop=new Map();
   for(const row of endPaths.data||[]){const end=endByTripFull.get(row.trip_id);if(!end||row.stop_sequence>=end.stop_sequence)continue;if(!endsByStop.has(row.stop_id))endsByStop.set(row.stop_id,[]);endsByStop.get(row.stop_id).push(row)}
   const transfers=[];
   for(const row of startPaths.data||[]){
    const start=startByTrip.get(row.trip_id);if(!start||row.stop_sequence<=start.stop_sequence)continue;
    for(const next of endsByStop.get(row.stop_id)||[]){
     const firstRoute=start.scheduled_trips.route_id,secondTrip=endByTripFull.get(next.trip_id);
     const secondRoute=secondTrip?.scheduled_trips?.route_id;
     if(!secondRoute||firstRoute===secondRoute)continue;
     transfers.push({legs:[
      {routeId:firstRoute,tripId:row.trip_id,from:origin.name,to:row.transport_stops.name,stops:row.stop_sequence-start.stop_sequence},
      {routeId:secondRoute,tripId:next.trip_id,from:row.transport_stops.name,to:dest.name,stops:secondTrip.stop_sequence-next.stop_sequence}
     ],transfers:1});
    }
   }
   const unique=new Map();
   for(const j of [...direct,...transfers]){const k=j.legs.map(l=>l.tripId+":"+l.from+":"+l.to).join("|");if(!unique.has(k))unique.set(k,j)}
   const all=[...unique.values()].sort((x,y)=>x.transfers-y.transfers||x.legs.reduce((n,l)=>n+l.stops,0)-y.legs.reduce((n,l)=>n+l.stops,0)).slice(0,6);
   if(!all.length){setDataInfo("No active imported trip path was found for these stops. The current community feed may not include this journey or service date.");}
   else{
    const routeIds=[...new Set(all.flatMap(j=>j.legs.map(l=>l.routeId)))];
    const [routeResult,fareResult]=await Promise.all([
     supabase.from("transport_routes").select("id,operator_id,route_short_name,route_long_name,mode").in("id",routeIds),
     supabase.from("transport_fare_rules").select("route_id,transport_fare_products!inner(price,currency)").in("route_id",routeIds).limit(100)
    ]);
    if(routeResult.error)throw new Error(routeResult.error.message);
    const routeById=new Map((routeResult.data||[]).map(x=>[x.id,x]));
    const fareByRoute=new Map();for(const f of fareResult.data||[]){if(!fareByRoute.has(f.route_id))fareByRoute.set(f.route_id,[]);fareByRoute.get(f.route_id).push(f.transport_fare_products)}
    for(const j of all){j.legs=j.legs.map(l=>({...l,route:routeById.get(l.routeId)})).filter(l=>l.route);j.minutes=j.legs.reduce((n,l)=>n+Math.max(4,l.stops*3),0)+(j.transfers?8:0);j.fare=j.legs.map(l=>estimateFare(fareByRoute.get(l.route.id))).join(" + ")}
    setJourneys(all.filter(j=>j.legs.length));setDataInfo("Route paths come from active GTFS trip stop sequences. Duration is an indicative estimate (3 min per stop + transfer buffer), not an operator-published timetable or live ETA. Fares appear only when the feed supplies fare rules.");
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
