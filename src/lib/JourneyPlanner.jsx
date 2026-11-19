import React,{useEffect,useState} from "react";
import {ArrowRight,Bus,Train,MapPin,Navigation,Search,Clock3,Wallet,RefreshCw,LocateFixed} from "lucide-react";
import {hasSupabase,supabase} from "./supabase";
import AITravelAssistant from "./AITravelAssistant.jsx";
import JourneyRoutesMap from "./JourneyRoutesMap.jsx";
const modeName={bus:"Bus",suburban_rail:"Local train",metro:"Metro",ferry:"Ferry",other:"Transit"};
const minsBetween=(start,end)=>{if(!start||!end)return null;const toMins=s=>{const [h,m,sec]=s.split(":").map(Number);return h*60+m+(sec||0)/60};let n=toMins(end)-toMins(start);if(n<0)n+=1440;return n>0&&n<360?Math.round(n):null};
async function geocodeIndia(query,limit=5){
 const url="https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit="+limit+"&q="+encodeURIComponent(query);
 const response=await fetch(url,{headers:{"Accept-Language":"en"}});
 if(!response.ok)throw new Error("Place suggestions are temporarily unavailable.");
 return (await response.json()).map(x=>({id:null,name:x.name||x.display_name.split(",")[0],lat:Number(x.lat),lng:Number(x.lon),label:x.display_name,source:"place"}));
}
function StopPicker({label,value,onChange,onSelect,placeholder,onUseLocation,locationBusy}){
 const [hits,setHits]=useState([]),[open,setOpen]=useState(false),[loading,setLoading]=useState(false);
 useEffect(()=>{
  const query=String(value||"").trim();if(query.length<2){setHits([]);return}
  const timer=setTimeout(async()=>{
   setLoading(true);
   try{
    const results=[];
    if(hasSupabase){const {data}=await supabase.rpc("mumove_search_stops",{search_term:query,result_limit:6});(data||[]).forEach(s=>results.push({...s,source:"stop"}))}
    if(query.length>=3){try{const places=await geocodeIndia(query,4);places.forEach(p=>{if(!results.some(s=>s.name?.toLowerCase()===p.name.toLowerCase()))results.push(p)})}catch{}}
    setHits(results);setOpen(true);
   }finally{setLoading(false)}
  },650);
  return()=>clearTimeout(timer);
 },[value]);
 return <div className="stop-picker"><label>{label}</label><div className="planner-input"><MapPin size={17}/><input value={value?.name||value||""} onChange={e=>onChange(e.target.value)} onFocus={()=>setOpen(true)} placeholder={placeholder}/>{loading&&<RefreshCw size={15} className="spin"/>}{onUseLocation&&<button type="button" className="planner-location-button" onClick={onUseLocation} aria-label="Use current location" disabled={locationBusy}><LocateFixed size={16}/></button>}</div>{open&&hits.length>0&&<div className="stop-suggestions">{hits.map((s,i)=><button type="button" key={s.id||s.label||i} onClick={()=>{onSelect(s);setOpen(false)}}><b>{s.name}</b><small>{s.source==="stop"?(modeName[s.stop_type==="bus_stop"?"bus":s.stop_type==="rail_station"?"suburban_rail":s.stop_type==="metro_station"?"metro":"other"]+" · "+(s.operator_id||"Imported stop")):(s.label||"Place in India")+" · place search"}</small></button>)}</div>}</div>
}

function getStaticGuide(from,to){
 const a=(from?.name||"").toLowerCase(),b=(to?.name||"").toLowerCase();
 const has=(s,...words)=>words.some(w=>s.includes(w));
 if(has(a,"bandra")&&has(b,"dadar"))return {title:"Bandra → Dadar by local train",time:"About 25–40 min overall (indicative)",steps:["From Bandra (E), reach Bandra suburban railway station using the signed station entrance; allow extra time for the east-side approach.","Board a northbound Western Line local towards Virar / Borivali / Bhayandar and get down at Dadar.","At Dadar, exit towards the destination side and walk or take a short local connection to Dadar Fire Brigade."],note:"The rail segment is a direct Western Line ride. Walking/access time varies. Check the station indicators for the correct train; no live arrivals or verified timetable is connected."};
 if(has(a,"dadar")&&has(b,"bandra"))return {title:"Dadar → Bandra by local train",time:"About 25–40 min overall (indicative)",steps:["Reach Dadar Western Line platforms and board a southbound Churchgate-bound local.","Get down at Bandra; use the east-side exit for Bandra (E).","Continue to the exact bus stop by walking or a short local connection."],note:"Direct Western Line guidance only; timings and platform information are not live. Confirm the destination-side exit at the station."};
 if(has(a,"andheri")&&has(b,"dadar"))return {title:"Andheri → Dadar by local train",time:"About 20–35 min overall (indicative)",steps:["Reach Andheri suburban railway station.","Board a southbound Churchgate-bound Western Line local.","Get down at Dadar and continue to the destination by the appropriate exit / short walk."],note:"Indicative guidance, not a live journey calculation. Confirm train direction and station exits locally."};
 if(has(a,"dadar")&&has(b,"andheri"))return {title:"Dadar → Andheri by local train",time:"About 20–35 min overall (indicative)",steps:["Reach Dadar Western Line platforms.","Board a northbound local towards Andheri / Borivali / Virar.","Get down at Andheri and continue to the destination by the appropriate exit / short walk."],note:"Indicative guidance, not a live journey calculation. Confirm train direction and station exits locally."};
 if(has(a,"andheri")&&has(b,"csmt","chhatrapati","vt"))return {title:"Andheri → CSMT by local train",time:"About 45–60 min (indicative)",steps:["At Andheri, board a Churchgate-bound Western Line local.","Get down at Dadar and change to the Central Line.","Board a CSMT-bound local and get down at Chhatrapati Shivaji Maharaj Terminus."],note:"A suitable Harbour Line service may offer another option at some times. This guide does not check operating patterns, timetables, delays or live arrivals."};
 if(has(a,"bandra")&&has(b,"csmt","chhatrapati","vt"))return {title:"Bandra → CSMT by local train",time:"About 35–50 min (indicative)",steps:["Reach Bandra suburban railway station.","A suitable Harbour Line service towards CSMT may be available; otherwise take a southbound Western Line local to Dadar.","If changing at Dadar, transfer to the Central Line and board a CSMT-bound local."],note:"Harbour Line service patterns vary. Check the current railway timetable and station indicators before choosing the direct option; MUMOVE has no live train feed."};
 if(has(a,"andheri")&&has(b,"ghatkopar"))return {title:"Andheri → Ghatkopar by Metro Line 1",time:"About 20–30 min (indicative)",steps:["Reach Andheri Metro station on Line 1.","Board a train towards Ghatkopar.","Get down at Ghatkopar Metro station and follow the signed exit for your destination."],note:"Indicative route guidance only. Confirm the currently operating service and ticket information with the operator."};
 return null;
}
function estimateFare(fareRows){return fareRows?.length?"₹"+Math.min(...fareRows.map(x=>Number(x.price))).toFixed(2):"Not published in feed"}
export default function JourneyPlanner({initialOrigin="",initialDestination="",currentLocation=null}){
 const [from,setFrom]=useState(initialOrigin),[to,setTo]=useState(initialDestination),[origin,setOrigin]=useState(null),[dest,setDest]=useState(null),[journeys,setJourneys]=useState([]),[guide,setGuide]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[dataInfo,setDataInfo]=useState(""),[locationBusy,setLocationBusy]=useState(false);
 useEffect(()=>{if(initialOrigin){setFrom(initialOrigin);setOrigin(null)}},[initialOrigin]);
 useEffect(()=>{if(initialDestination){setTo(initialDestination);setDest(null)}},[initialDestination]);
 async function resolveEndpoint(value){
  if(value?.id)return value;
  let point=value?.lat!=null?value:null;
  if(!point&&String(value||"").trim().toLowerCase()==="my location"&&!currentLocation)throw new Error("Tap the location button and allow location access, or enter a starting place.");
  if(!point&&String(value||"").trim().toLowerCase()==="my location"&&currentLocation)point={...currentLocation,name:"My location"};
  if(!point){const places=await geocodeIndia(String(value?.name||value||"").trim(),1);point=places[0]}
  if(!point)throw new Error("Could not find "+(value?.name||value)+". Choose a suggestion and try again.");
  const dLat=3/111.32,dLng=3/(111.32*Math.max(.2,Math.cos(point.lat*Math.PI/180)));
  const {data,error}=await supabase.from("transport_stops").select("id,name,stop_type,operator_id,latitude,longitude").gte("latitude",point.lat-dLat).lte("latitude",point.lat+dLat).gte("longitude",point.lng-dLng).lte("longitude",point.lng+dLng).limit(1000);
  if(error)throw error;
  const nearest=(data||[]).map(s=>({...s,lat:Number(s.latitude),lng:Number(s.longitude),distance:Math.hypot((Number(s.latitude)-point.lat)*111.32,(Number(s.longitude)-point.lng)*111.32*Math.cos(point.lat*Math.PI/180))})).filter(s=>Number.isFinite(s.distance)).sort((x,y)=>x.distance-y.distance)[0];
  if(!nearest||nearest.distance>3)throw new Error("No imported MUMOVE transport stop was found within 3 km of "+(point.name||"this place")+". MUMOVE will not snap your journey to a distant stop. Public-transport journeys are available only in areas where verified operator timetable feeds have been imported.");
  return {...nearest,name:nearest.name,matchedFrom:point.name||value?.name||value,distance:nearest.distance};
 }
 function useCurrentLocation(){
  if(!navigator.geolocation){setError("Location is not supported by this browser.");return}
  setLocationBusy(true);navigator.geolocation.getCurrentPosition(p=>{const point={lat:p.coords.latitude,lng:p.coords.longitude,name:"My location"};setOrigin(point);setFrom("My location");setLocationBusy(false)},e=>{setError(e.code===1?"Allow location permission in your browser settings.":"Could not get your location. Turn on GPS and retry.");setLocationBusy(false)},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
 }
 async function plan(){
  if(!hasSupabase){setError("Connect the MUMOVE Supabase project to search imported routes.");return}
  if(!from.trim()||!to.trim()){setError("Enter both a starting point and destination.");return}
  setBusy(true);setError("");setJourneys([]);setGuide(null);setDataInfo("");
  try{
   setOrigin(originStop);setDest(destStop);setFrom(originStop.name);setTo(destStop.name);
   const [a,b]=await Promise.all([
    supabase.from("trip_stop_times").select("trip_id,stop_sequence,departure_time,arrival_time,scheduled_trips!inner(route_id,departure_time,arrival_time)").eq("stop_id",originStop.id).limit(300),
    supabase.from("trip_stop_times").select("trip_id,stop_sequence,departure_time,arrival_time,scheduled_trips!inner(route_id,departure_time,arrival_time)").eq("stop_id",destStop.id).limit(300)
   ]);
   if(a.error||b.error)throw new Error(a.error?.message||b.error?.message);
   const starts=a.data||[],ends=b.data||[],endByTrip=new Map(ends.map(x=>[x.trip_id,x]));
   const direct=starts.filter(x=>endByTrip.has(x.trip_id)&&endByTrip.get(x.trip_id).stop_sequence>x.stop_sequence).map(x=>{
    const end=endByTrip.get(x.trip_id);
    const path=([]).concat([]); 
    return {legs:[{routeId:x.scheduled_trips.route_id,tripId:x.trip_id,from:originStop.name,to:destStop.name,stops:end.stop_sequence-x.stop_sequence,durationMinutes:minsBetween(x.departure_time,end.arrival_time)}],transfers:0};
   });
   const startTripIds=[...new Set(starts.map(x=>x.trip_id))].slice(0,150);
   const endTripIds=[...new Set(ends.map(x=>x.trip_id))].slice(0,150);
   const [startPaths,endPaths]=await Promise.all([
    startTripIds.length?supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,arrival_time,departure_time,transport_stops!inner(name,latitude,longitude)").in("trip_id",startTripIds).limit(12000):Promise.resolve({data:[]}),
    endTripIds.length?supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,arrival_time,departure_time,transport_stops!inner(name)").in("trip_id",endTripIds).limit(12000):Promise.resolve({data:[]})
   ]);
   if(startPaths.error||endPaths.error)throw new Error(startPaths.error?.message||endPaths.error?.message);
   const startByTrip=new Map(starts.map(x=>[x.trip_id,x])),endByTripFull=new Map(ends.map(x=>[x.trip_id,x]));
   const endsByStop=new Map();
   for(const row of endPaths.data||[]){const end=endByTripFull.get(row.trip_id);if(!end||row.stop_sequence>=end.stop_sequence)continue;if(!endsByStop.has(row.stop_id))endsByStop.set(row.stop_id,[]);endsByStop.get(row.stop_id).push(row)}
   const startRowsByTrip=new Map(),endRowsByTrip=new Map();
   for(const row of startPaths.data||[]){if(!startRowsByTrip.has(row.trip_id))startRowsByTrip.set(row.trip_id,[]);startRowsByTrip.get(row.trip_id).push(row)}
   for(const row of endPaths.data||[]){if(!endRowsByTrip.has(row.trip_id))endRowsByTrip.set(row.trip_id,[]);endRowsByTrip.get(row.trip_id).push(row)}
   const coordsFor=(rows,lo,hi)=>rows.filter(r=>r.stop_sequence>=lo&&r.stop_sequence<=hi).map(r=>[Number(r.transport_stops.latitude),Number(r.transport_stops.longitude)]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
   for(const j of direct){const l=j.legs[0],s=startByTrip.get(l.tripId),e=endByTripFull.get(l.tripId);l.path=coordsFor(startRowsByTrip.get(l.tripId)||[],s.stop_sequence,e.stop_sequence)}
   const transfers=[];
   for(const row of startPaths.data||[]){
    const start=startByTrip.get(row.trip_id);if(!start||row.stop_sequence<=start.stop_sequence)continue;
    for(const next of endsByStop.get(row.stop_id)||[]){
     const firstRoute=start.scheduled_trips.route_id,secondTrip=endByTripFull.get(next.trip_id);
     const secondRoute=secondTrip?.scheduled_trips?.route_id;
     if(!secondRoute||firstRoute===secondRoute)continue;
     transfers.push({legs:[
      {routeId:firstRoute,tripId:row.trip_id,from:origin.name,to:row.transport_stops.name,stops:row.stop_sequence-start.stop_sequence,durationMinutes:minsBetween(start.departure_time,row.arrival_time),path:coordsFor(startRowsByTrip.get(row.trip_id)||[],start.stop_sequence,row.stop_sequence)},
      {routeId:secondRoute,tripId:next.trip_id,from:row.transport_stops.name,to:dest.name,stops:secondTrip.stop_sequence-next.stop_sequence,durationMinutes:minsBetween(next.departure_time,secondTrip.arrival_time),path:coordsFor(endRowsByTrip.get(next.trip_id)||[],next.stop_sequence,secondTrip.stop_sequence)}
     ],transfers:1});
    }
   }
   const unique=new Map();
   for(const j of [...direct,...transfers]){const k=j.legs.map(l=>l.tripId+":"+l.from+":"+l.to).join("|");if(!unique.has(k))unique.set(k,j)}
   const all=[...unique.values()].sort((x,y)=>x.transfers-y.transfers||x.legs.reduce((n,l)=>n+l.stops,0)-y.legs.reduce((n,l)=>n+l.stops,0)).slice(0,6);
   if(!all.length){const fallback=getStaticGuide(originStop,destStop);setGuide(fallback);setDataInfo(fallback?"No matching bus trip was found in the imported static bus timetable. Here is a separate, indicative rail/metro route guide for this pair.":"No matching bus trip was found in the imported static bus timetable, and MUMOVE has no verified rail/metro route for this exact pair yet. Try nearby station names. Live arrivals are not connected.");}
   else{
    const routeIds=[...new Set(all.flatMap(j=>j.legs.map(l=>l.routeId)))];
    const [routeResult,fareResult]=await Promise.all([
     supabase.from("transport_routes").select("id,operator_id,route_short_name,route_long_name,mode").in("id",routeIds),
     supabase.from("transport_fare_rules").select("route_id,transport_fare_products!inner(price,currency)").in("route_id",routeIds).limit(100)
    ]);
    if(routeResult.error)throw new Error(routeResult.error.message);
    const routeById=new Map((routeResult.data||[]).map(x=>[x.id,x]));
    const fareByRoute=new Map();for(const f of fareResult.data||[]){if(!fareByRoute.has(f.route_id))fareByRoute.set(f.route_id,[]);fareByRoute.get(f.route_id).push(f.transport_fare_products)}
    for(const j of all){j.legs=j.legs.map(l=>({...l,route:routeById.get(l.routeId)})).filter(l=>l.route);j.minutes=j.legs.reduce((n,l)=>n+(l.durationMinutes??Math.max(4,l.stops*3)),0)+(j.transfers?8:0);j.fare=j.legs.map(l=>estimateFare(fareByRoute.get(l.route.id))).join(" + ")}
    setJourneys(all.filter(j=>j.legs.length));setDataInfo("Route paths and in-vehicle duration come from active GTFS trip stop times. Transfer time is an 8-minute planning buffer, not a guaranteed connection. Fares appear only when the feed supplies fare rules.");
   }
  }catch(e){setError(e.message||"Could not calculate routes.")}finally{setBusy(false)}
 }
 return <><div className="panel planner-panel journey-planner"><div className="panel-heading"><div><b>Find a connected journey</b><small>Search places across India · transit results require imported local operator feeds</small></div><span className="status-tag">GTFS-backed</span></div>
 <StopPicker label="FROM" value={from} onChange={v=>{setFrom(v);setOrigin(null)}} onSelect={s=>{setOrigin(s);setFrom(s.name)}} onUseLocation={useCurrentLocation} locationBusy={locationBusy} placeholder="Search any place in India"/>
 <StopPicker label="TO" value={to} onChange={v=>{setTo(v);setDest(null)}} onSelect={s=>{setDest(s);setTo(s.name)}} onUseLocation={()=>{}} placeholder="Search destination anywhere in India"/>
 <button className="button primary full" onClick={plan} disabled={busy||!from.trim()||!to.trim()}>{busy?<RefreshCw className="spin" size={16}/>:<Navigation size={16}/>} Find journeys</button>
 {error&&<div className="notice">{error}</div>}{origin?.matchedFrom&&<div className="planner-note">Nearest imported stop to {origin.matchedFrom}: {origin.name} ({origin.distance.toFixed(1)} km away).</div>}{dest?.matchedFrom&&<div className="planner-note">Nearest imported stop to {dest.matchedFrom}: {dest.name} ({dest.distance.toFixed(1)} km away).</div>}{dataInfo&&<div className="notice">{dataInfo}</div>}{guide&&<article className="journey-result" style={{marginTop:14}}><div className="journey-top"><b>{guide.title}</b><span><Clock3 size={14}/> {guide.time}</span></div><div style={{display:"grid",gap:12,marginTop:14}}>{guide.steps.map((step,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{display:"grid",placeItems:"center",minWidth:25,height:25,borderRadius:20,background:"var(--soft, #eef2f5)",fontWeight:700}}>{i+1}</span><span>{step}</span></div>)}</div><div className="notice" style={{marginTop:14}}>{guide.note}</div><div className="journey-foot"><span>Indicative route guide · not GTFS-verified</span><small>Check official operator updates before travel</small></div></article>}
 {journeys.length>0&&<JourneyRoutesMap journeys={journeys}/>} {journeys.map((j,i)=><article className="journey-result" key={i}><div className="journey-top"><b>GTFS option {i+1} · {j.transfers===0?"Direct":"1 transfer"}</b><span><Clock3 size={14}/> ~{j.minutes} min</span></div>{j.legs.map((l,n)=><div className="journey-leg" key={n}><span className="row-icon">{l.route.mode==="bus"?<Bus size={18}/>:<Train size={18}/>}</span><div><b>{modeName[l.route.mode]} · {l.route.route_short_name||l.route.route_long_name}</b><small>{l.from} → {l.to}</small></div></div>)}<div className="journey-foot"><span><Wallet size={14}/> {j.fare}</span><small>Fare shown only when GTFS publishes it</small></div></article>)}
 {!journeys.length&&!dataInfo&&<div className="planner-note">Import the public Mumbai GTFS schedule first. Timetables, live arrivals and operator fares are shown only when the source publishes them.</div>}
 </div><AITravelAssistant/></>
}
