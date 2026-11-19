import React,{useEffect,useState} from "react";
import {ArrowRight,Bus,Train,MapPin,Navigation,Search,Clock3,Wallet,RefreshCw,LocateFixed} from "lucide-react";
import {hasSupabase,supabase} from "./supabase";
import AITravelAssistant from "./AITravelAssistant.jsx";
import JourneyRoutesMap from "./JourneyRoutesMap.jsx";
const modeName={bus:"Bus",suburban_rail:"Local train",metro:"Metro",ferry:"Ferry",other:"Transit"};
const minsBetween=(start,end)=>{if(!start||!end)return null;const toMins=s=>{const [h,m,sec]=s.split(":").map(Number);return h*60+m+(sec||0)/60};let n=toMins(end)-toMins(start);if(n<0)n+=1440;return n>0&&n<360?Math.round(n):null};
const transferPossible=(arrival,departure)=>{
 if(!arrival||!departure)return false;
 const toMins=s=>{const [h,m,sec]=s.split(":").map(Number);return h*60+m+(sec||0)/60};
 let wait=toMins(departure)-toMins(arrival);if(wait<0)wait+=1440;
 return wait>=8&&wait<=90;
};
async function fetchPaged(queryFactory,maxRows=20000,pageSize=1000){
 const rows=[];
 for(let offset=0;offset<maxRows;offset+=pageSize){
  const {data,error}=await queryFactory().range(offset,offset+pageSize-1);
  if(error)return {data:null,error};
  const page=data||[];rows.push(...page);
  if(page.length<pageSize)break;
 }
 return {data:rows,error:null};
}
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
  if(value?.id)return {...value,candidates:[value]};
  let point=value?.lat!=null?value:null;
  if(!point&&String(value||"").trim().toLowerCase()==="my location"&&!currentLocation)throw new Error("Tap the location button and allow location access, or enter a starting place.");
  if(!point&&String(value||"").trim().toLowerCase()==="my location"&&currentLocation)point={...currentLocation,name:"My location"};
  if(!point){const places=await geocodeIndia(String(value?.name||value||"").trim(),1);point=places[0]}
  if(!point)throw new Error("Could not find "+(value?.name||value)+". Choose a suggestion and try again.");
  const dLat=3/111.32,dLng=3/(111.32*Math.max(.2,Math.cos(point.lat*Math.PI/180)));
  const {data,error}=await supabase.from("transport_stops").select("id,name,stop_type,operator_id,latitude,longitude").gte("latitude",point.lat-dLat).lte("latitude",point.lat+dLat).gte("longitude",point.lng-dLng).lte("longitude",point.lng+dLng).limit(1000);
  if(error)throw error;
  const nearby=(data||[]).map(s=>({...s,lat:Number(s.latitude),lng:Number(s.longitude),distance:Math.hypot((Number(s.latitude)-point.lat)*111.32,(Number(s.longitude)-point.lng)*111.32*Math.cos(point.lat*Math.PI/180))})).filter(s=>Number.isFinite(s.distance)&&s.distance<=3).sort((x,y)=>x.distance-y.distance);
  const nearest=nearby[0];
  if(!nearest)throw new Error("No imported MUMOVE transport stop was found within 3 km of "+(point.name||"this place")+". MUMOVE will not snap your journey to a distant stop. Public-transport journeys are available only in areas where verified operator timetable feeds have been imported.");
  return {...nearest,name:nearest.name,matchedFrom:point.name||value?.name||value,distance:nearest.distance,candidates:nearby.slice(0,20)};
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
   // Resolve typed places to nearby imported stops, or keep a stop selected from suggestions.
   // This is the bridge between India-wide map search and the currently imported transit feeds.
   const originStop=await resolveEndpoint(origin||from);
   const destStop=await resolveEndpoint(dest||to);
   setOrigin(originStop);setDest(destStop);setFrom(originStop.name);setTo(destStop.name);
   const originIds=(originStop.candidates||[originStop]).map(s=>s.id).filter(Boolean);
   const destinationIds=(destStop.candidates||[destStop]).map(s=>s.id).filter(Boolean);
   const [a,b]=await Promise.all([
    fetchPaged(()=>supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,departure_time,arrival_time,scheduled_trips!inner(route_id,departure_time,arrival_time),transport_stops!inner(name,latitude,longitude)").in("stop_id",originIds).order("trip_id").order("stop_sequence"),10000),
    fetchPaged(()=>supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,departure_time,arrival_time,scheduled_trips!inner(route_id,departure_time,arrival_time),transport_stops!inner(name,latitude,longitude)").in("stop_id",destinationIds).order("trip_id").order("stop_sequence"),10000)
   ]);
   if(a.error||b.error)throw new Error(a.error?.message||b.error?.message);
   const starts=a.data||[],ends=b.data||[];
   const endsByTrip=new Map();
   for(const row of ends){if(!endsByTrip.has(row.trip_id))endsByTrip.set(row.trip_id,[]);endsByTrip.get(row.trip_id).push(row)}
   const direct=[];
   for(const start of starts){
    for(const end of endsByTrip.get(start.trip_id)||[]){
     if(end.stop_sequence<=start.stop_sequence)continue;
     direct.push({legs:[{routeId:start.scheduled_trips.route_id,tripId:start.trip_id,from:start.transport_stops.name,to:end.transport_stops.name,stops:end.stop_sequence-start.stop_sequence,durationMinutes:minsBetween(start.departure_time,end.arrival_time),startSequence:start.stop_sequence,endSequence:end.stop_sequence}],transfers:0});
    }
   }
   const startTripIds=[...new Set(starts.map(x=>x.trip_id))].slice(0,250);
   const endTripIds=[...new Set(ends.map(x=>x.trip_id))].slice(0,250);
   const [startPaths,endPaths]=await Promise.all([
    startTripIds.length?fetchPaged(()=>supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,arrival_time,departure_time,transport_stops!inner(name,latitude,longitude)").in("trip_id",startTripIds).order("trip_id").order("stop_sequence"),20000):Promise.resolve({data:[],error:null}),
    endTripIds.length?fetchPaged(()=>supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,arrival_time,departure_time,transport_stops!inner(name,latitude,longitude)").in("trip_id",endTripIds).order("trip_id").order("stop_sequence"),20000):Promise.resolve({data:[],error:null})
   ]);
   if(startPaths.error||endPaths.error)throw new Error(startPaths.error?.message||endPaths.error?.message);
   const startsByTrip=new Map(),endsByTripFull=new Map(),startRowsByTrip=new Map(),endRowsByTrip=new Map();
   for(const row of starts){if(!startsByTrip.has(row.trip_id))startsByTrip.set(row.trip_id,[]);startsByTrip.get(row.trip_id).push(row)}
   for(const row of ends){if(!endsByTripFull.has(row.trip_id))endsByTripFull.set(row.trip_id,[]);endsByTripFull.get(row.trip_id).push(row)}
   for(const row of startPaths.data||[]){if(!startRowsByTrip.has(row.trip_id))startRowsByTrip.set(row.trip_id,[]);startRowsByTrip.get(row.trip_id).push(row)}
   for(const row of endPaths.data||[]){if(!endRowsByTrip.has(row.trip_id))endRowsByTrip.set(row.trip_id,[]);endRowsByTrip.get(row.trip_id).push(row)}
   const coordsFor=(rows,lo,hi)=>rows.filter(r=>r.stop_sequence>=lo&&r.stop_sequence<=hi).map(r=>[Number(r.transport_stops.latitude),Number(r.transport_stops.longitude)]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
   for(const j of direct){const l=j.legs[0];l.path=coordsFor(startRowsByTrip.get(l.tripId)||[],l.startSequence,l.endSequence)}
   const endsByStop=new Map();
   for(const row of endPaths.data||[]){
    for(const end of endsByTripFull.get(row.trip_id)||[]){
     if(end.stop_sequence<=row.stop_sequence)continue;
     if(!endsByStop.has(row.stop_id))endsByStop.set(row.stop_id,[]);
     endsByStop.get(row.stop_id).push({...row,end});
    }
   }
   const transfers=[];
   for(const start of starts){
    for(const row of startRowsByTrip.get(start.trip_id)||[]){
     if(row.stop_sequence<=start.stop_sequence)continue;
     for(const next of endsByStop.get(row.stop_id)||[]){
      if(next.trip_id===start.trip_id)continue;
      const firstRoute=start.scheduled_trips.route_id,secondRoute=next.end.scheduled_trips.route_id;
      if(!secondRoute||firstRoute===secondRoute||!transferPossible(row.arrival_time,next.departure_time))continue;
      transfers.push({legs:[
       {routeId:firstRoute,tripId:start.trip_id,from:start.transport_stops.name,to:row.transport_stops.name,stops:row.stop_sequence-start.stop_sequence,durationMinutes:minsBetween(start.departure_time,row.arrival_time),path:coordsFor(startRowsByTrip.get(start.trip_id)||[],start.stop_sequence,row.stop_sequence)},
       {routeId:secondRoute,tripId:next.trip_id,from:row.transport_stops.name,to:next.end.transport_stops.name,stops:next.end.stop_sequence-next.stop_sequence,durationMinutes:minsBetween(next.departure_time,next.end.arrival_time),path:coordsFor(endRowsByTrip.get(next.trip_id)||[],next.stop_sequence,next.end.stop_sequence)}
      ],transfers:1});
     }
    }
   }
   // Search a second interchange as well, so the planner can combine up to three
   // GTFS trip legs when a direct or one-transfer connection does not exist.
   const firstLegsByStop=new Map();
   for(const row of startPaths.data||[]){
    for(const start of startsByTrip.get(row.trip_id)||[]){
     if(row.stop_sequence<=start.stop_sequence)continue;
     if(!firstLegsByStop.has(row.stop_id))firstLegsByStop.set(row.stop_id,[]);
     firstLegsByStop.get(row.stop_id).push({start,transfer:row,routeId:start.scheduled_trips.route_id});
    }
   }
   const firstTransferStopIds=[...firstLegsByStop.keys()].slice(0,250);
   const twoTransfers=[];
   if(firstTransferStopIds.length){
    const midStartResult=await fetchPaged(()=>supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,arrival_time,departure_time,scheduled_trips!inner(route_id),transport_stops!inner(name,latitude,longitude)").in("stop_id",firstTransferStopIds).order("trip_id").order("stop_sequence"),8000);
    if(midStartResult.error)throw new Error(midStartResult.error.message);
    const midStarts=midStartResult.data||[];
    const midTripIds=[...new Set(midStarts.map(x=>x.trip_id))].slice(0,120);
    if(midTripIds.length){
     const midPathResult=await fetchPaged(()=>supabase.from("trip_stop_times").select("trip_id,stop_id,stop_sequence,arrival_time,departure_time,transport_stops!inner(name,latitude,longitude)").in("trip_id",midTripIds).order("trip_id").order("stop_sequence"),12000);
     if(midPathResult.error)throw new Error(midPathResult.error.message);
     const midRowsByTrip=new Map();
     for(const row of midPathResult.data||[]){if(!midRowsByTrip.has(row.trip_id))midRowsByTrip.set(row.trip_id,[]);midRowsByTrip.get(row.trip_id).push(row)}
     for(const midStart of midStarts){
      const firstOptions=firstLegsByStop.get(midStart.stop_id)||[];
      if(!firstOptions.length)continue;
      for(const first of firstOptions){
       if(first.start.trip_id===midStart.trip_id||first.routeId===midStart.scheduled_trips.route_id||!transferPossible(first.transfer.arrival_time,midStart.departure_time))continue;
       for(const midRow of midRowsByTrip.get(midStart.trip_id)||[]){
        if(midRow.stop_sequence<=midStart.stop_sequence)continue;
        for(const last of endsByStop.get(midRow.stop_id)||[]){
         const finalRoute=last.end.scheduled_trips.route_id;
         if(!finalRoute||last.trip_id===midStart.trip_id||last.trip_id===first.start.trip_id)continue;
         if(finalRoute===midStart.scheduled_trips.route_id||finalRoute===first.routeId||!transferPossible(midRow.arrival_time,last.departure_time))continue;
         twoTransfers.push({legs:[
          {routeId:first.routeId,tripId:first.start.trip_id,from:first.start.transport_stops.name,to:first.transfer.transport_stops.name,stops:first.transfer.stop_sequence-first.start.stop_sequence,durationMinutes:minsBetween(first.start.departure_time,first.transfer.arrival_time),path:coordsFor(startRowsByTrip.get(first.start.trip_id)||[],first.start.stop_sequence,first.transfer.stop_sequence)},
          {routeId:midStart.scheduled_trips.route_id,tripId:midStart.trip_id,from:midStart.transport_stops.name,to:midRow.transport_stops.name,stops:midRow.stop_sequence-midStart.stop_sequence,durationMinutes:minsBetween(midStart.departure_time,midRow.arrival_time),path:coordsFor(midRowsByTrip.get(midStart.trip_id)||[],midStart.stop_sequence,midRow.stop_sequence)},
          {routeId:finalRoute,tripId:last.trip_id,from:midRow.transport_stops.name,to:last.end.transport_stops.name,stops:last.end.stop_sequence-last.stop_sequence,durationMinutes:minsBetween(last.departure_time,last.end.arrival_time),path:coordsFor(endRowsByTrip.get(last.trip_id)||[],last.stop_sequence,last.end.stop_sequence)}
         ],transfers:2});
        }
       }
      }
     }
    }
   }
   const unique=new Map();
   for(const j of [...direct,...transfers,...twoTransfers]){const k=j.legs.map(l=>l.tripId+":"+l.from+":"+l.to).join("|");if(!unique.has(k))unique.set(k,j)}
   const all=[...unique.values()].sort((x,y)=>x.transfers-y.transfers||x.legs.reduce((n,l)=>n+l.stops,0)-y.legs.reduce((n,l)=>n+l.stops,0)).slice(0,8);
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
 {error&&<div className="notice">{error}</div>}{origin?.matchedFrom&&<div className="planner-note">Searching nearby stops around {origin.matchedFrom}; closest: {origin.name} ({origin.distance.toFixed(1)} km).</div>}{dest?.matchedFrom&&<div className="planner-note">Searching nearby stops around {dest.matchedFrom}; closest: {dest.name} ({dest.distance.toFixed(1)} km).</div>}{dataInfo&&<div className="notice">{dataInfo}</div>}{guide&&<article className="journey-result" style={{marginTop:14}}><div className="journey-top"><b>{guide.title}</b><span><Clock3 size={14}/> {guide.time}</span></div><div style={{display:"grid",gap:12,marginTop:14}}>{guide.steps.map((step,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{display:"grid",placeItems:"center",minWidth:25,height:25,borderRadius:20,background:"var(--soft, #eef2f5)",fontWeight:700}}>{i+1}</span><span>{step}</span></div>)}</div><div className="notice" style={{marginTop:14}}>{guide.note}</div><div className="journey-foot"><span>Indicative route guide · not GTFS-verified</span><small>Check official operator updates before travel</small></div></article>}
 {journeys.length>0&&<JourneyRoutesMap journeys={journeys}/>} {journeys.map((j,i)=><article className="journey-result" key={i}><div className="journey-top"><b>GTFS option {i+1} · {j.transfers===0?"Direct":j.transfers===1?"1 transfer":j.transfers+" transfers"}</b><span><Clock3 size={14}/> ~{j.minutes} min</span></div>{j.legs.map((l,n)=><div className="journey-leg" key={n}><span className="row-icon">{l.route.mode==="bus"?<Bus size={18}/>:<Train size={18}/>}</span><div><b>{modeName[l.route.mode]} · {l.route.route_short_name||l.route.route_long_name}</b><small>{l.from} → {l.to}</small></div></div>)}<div className="journey-foot"><span><Wallet size={14}/> {j.fare}</span><small>Fare shown only when GTFS publishes it</small></div></article>)}
 {!journeys.length&&!dataInfo&&<div className="planner-note">Import the public Mumbai GTFS schedule first. Timetables, live arrivals and operator fares are shown only when the source publishes them.</div>}
 </div><AITravelAssistant/></>
}
