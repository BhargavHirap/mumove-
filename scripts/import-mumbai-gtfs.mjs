/**
 * Import the public community Mumbai GTFS schedule (BEST/TMT/KDMT).
 * Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:gtfs
 * The source is community-maintained, not an official operator feed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import unzipper from "unzipper";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";

const FEED_URL = process.env.MUMOVE_GTFS_URL || "https://github.com/croyla/mumbai-gtfs/raw/refs/heads/main/gtfs_compat.zip";
const SOURCE = "https://github.com/croyla/mumbai-gtfs";
const BATCH = 500;
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never use the service key in browser code.");
const db = createClient(url, key, { auth: { persistSession: false } });
const temp = path.join(os.tmpdir(), "mumove-mumbai-gtfs.zip");
const now = new Date();
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const sourceRef = FEED_URL;

async function download() {
  const res = await fetch(FEED_URL, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error("GTFS download failed: HTTP " + res.status);
  await pipeline(res.body, createWriteStream(temp));
  console.log("Downloaded GTFS zip", fs.statSync(temp).size, "bytes");
}
async function rows(archive, filename, callback) {
  const entry = archive.files.find(f => f.path.toLowerCase() === filename.toLowerCase());
  if (!entry) return 0;
  const parser = entry.stream().pipe(parse({ columns: true, bom: true, relax_quotes: true, skip_empty_lines: true, trim: true }));
  let count = 0;
  for await (const row of parser) { await callback(row); count++; }
  console.log(filename, count);
  return count;
}
async function upsert(table, batch, conflict) {
  if (!batch.length) return;
  const { error } = await db.from(table).upsert(batch, { onConflict: conflict, ignoreDuplicates: false });
  if (error) throw new Error(table + ": " + error.message);
}
async function batchRows(table, iterable, conflict) {
  let batch = [], total = 0;
  for await (const row of iterable) {
    batch.push(row);
    if (batch.length >= BATCH) { await upsert(table, batch, conflict); total += batch.length; batch = []; }
  }
  await upsert(table, batch, conflict); total += batch.length;
  return total;
}
const asTime = value => {
  if (!value) return "00:00:00";
  const [h=0,m=0,s=0] = value.split(":").map(Number);
  const seconds = ((h*3600 + m*60 + s) % 86400 + 86400) % 86400;
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,"0")).join(":");
};
const date = s => s ? s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8) : null;
const bool = v => v === "1" || v === "true";
const operatorFor = name => {
  const n=(name||"").toLowerCase();
  if (/tmt|thane municipal/.test(n)) return "tmt";
  if (/kdmt|kalyan.?dombivli/.test(n)) return "kdmt";
  return "best";
};
async function main() {
  await download();
  const archive = await unzipper.Open.file(temp);
  const agencyById = new Map();
  const routeById = new Map();
  const tripById = new Map();
  const serviceIds = new Set();
  const activeService = new Set();
  const activeTrips = new Set();
  const operators = [
    {id:"best",name:"BEST Undertaking",mode:"bus",region:"Mumbai",official_url:"https://www.bestundertaking.com/",data_status:"reference_only",updated_at:new Date().toISOString()},
    {id:"tmt",name:"Thane Municipal Transport",mode:"bus",region:"Thane",official_url:"https://thanecity.gov.in/",data_status:"reference_only",updated_at:new Date().toISOString()},
    {id:"kdmt",name:"Kalyan-Dombivli Municipal Transport",mode:"bus",region:"Kalyan-Dombivli",official_url:"https://kdmc.gov.in/",data_status:"reference_only",updated_at:new Date().toISOString()}
  ];
  const opWrite=await db.from("transport_operators").upsert(operators,{onConflict:"id"});
  if(opWrite.error) throw opWrite.error;
  await rows(archive,"agency.txt",async r=>{agencyById.set(r.agency_id, r.agency_name || "BEST Undertaking")});
  // Import stops first so all subsequent GTFS foreign keys resolve.
  let stopBatch=[];
  await rows(archive,"stops.txt",async r=>{
    const agencyName=agencyById.values().next().value || "BEST Undertaking";
    const op=operatorFor(agencyName);
    const lat=Number(r.stop_lat),lon=Number(r.stop_lon);
    if(!r.stop_id||!r.stop_name||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
    stopBatch.push({id:r.stop_id,operator_id:op,name:r.stop_name,latitude:lat,longitude:lon,stop_type:"bus_stop",wheelchair_accessible:r.wheelchair_boarding?bool(r.wheelchair_boarding):null,source_ref:SOURCE,zone_id:r.zone_id||null,updated_at:new Date().toISOString()});
    if(stopBatch.length>=BATCH){await upsert("transport_stops",stopBatch,"id");stopBatch=[]}
  });
  await upsert("transport_stops",stopBatch,"id");
  await rows(archive,"routes.txt",async r=>{
    const agency=agencyById.get(r.agency_id) || "BEST Undertaking";
    const op=operatorFor(agency);
    routeById.set(r.route_id,op);
    const item={id:r.route_id,operator_id:op,route_short_name:r.route_short_name||null,route_long_name:r.route_long_name||r.route_short_name||r.route_id,mode:"bus",source_ref:SOURCE,active:true,updated_at:new Date().toISOString()};
    const {error}=await db.from("transport_routes").upsert(item,{onConflict:"id"});
    if(error)throw error;
  });
  // Calendar validation: retain services operating today or in the next 14 days.
  const calendarRows=[];
  await rows(archive,"calendar.txt",async r=>{
    const item={service_id:r.service_id,monday:bool(r.monday),tuesday:bool(r.tuesday),wednesday:bool(r.wednesday),thursday:bool(r.thursday),friday:bool(r.friday),saturday:bool(r.saturday),sunday:bool(r.sunday),start_date:date(r.start_date),end_date:date(r.end_date),source_ref:SOURCE,updated_at:new Date().toISOString()};
    if(item.start_date&&item.end_date)calendarRows.push(item);
  });
  await batchRows("transport_service_calendars",(async function*(){for(const x of calendarRows)yield x})(),"service_id");
  const upcomingDates=[];
  const today=new Date(ymd+"T12:00:00+05:30");
  for(let i=0;i<15;i++){const d=new Date(today);d.setDate(d.getDate()+i);upcomingDates.push({date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d),weekday:["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][d.getDay()]});}
  const exceptions=new Map();
  await rows(archive,"calendar_dates.txt",async r=>{const d=date(r.date);if(!upcomingDates.some(x=>x.date===d))return;if(!exceptions.has(r.service_id))exceptions.set(r.service_id,new Map());exceptions.get(r.service_id).set(d,r.exception_type);});
  for(const cal of calendarRows){
    for(const day of upcomingDates){
      if(day.date<cal.start_date||day.date>cal.end_date)continue;
      const exception=exceptions.get(cal.service_id)?.get(day.date);
      if(exception==="1"||(exception!=="2"&&cal[day.weekday])){activeService.add(cal.service_id);break;}
    }
  }
  for(const [serviceId,dates] of exceptions){if([...dates.values()].includes("1"))activeService.add(serviceId);}
  // Trips are inserted before stop_times to satisfy the relational FK.
  let tripBatch=[];
  await rows(archive,"trips.txt",async r=>{
    if(!activeService.has(r.service_id))return;
    const op=routeById.get(r.route_id);
    if(!op)return;
    tripById.set(r.trip_id,{route_id:r.route_id,operator_id:op,service_id:r.service_id});
    activeTrips.add(r.trip_id);
    tripBatch.push({id:r.trip_id,route_id:r.route_id,service_date:null,departure_time:"00:00:00",arrival_time:null,direction_label:r.direction_id||null,calendar_ref:r.service_id,source_ref:SOURCE,source_updated_at:new Date().toISOString(),verified_at:new Date().toISOString(),is_current:true});
    if(tripBatch.length>=BATCH){await upsert("scheduled_trips",tripBatch,"id");tripBatch=[]}
  });
  await upsert("scheduled_trips",tripBatch,"id");
  // Store route stop sequences and actual trip stop times in bounded batches.
  let timeBatch=[],routeStopBatch=new Map();
  const firstLast=new Map();
  await rows(archive,"stop_times.txt",async r=>{
    if(!activeTrips.has(r.trip_id))return;
    const t=asTime(r.departure_time||r.arrival_time);
    const a=asTime(r.arrival_time||r.departure_time);
    const seq=Number(r.stop_sequence);
    if(!r.stop_id||!Number.isInteger(seq)||seq<1)return;
    timeBatch.push({trip_id:r.trip_id,stop_id:r.stop_id,stop_sequence:seq,arrival_time:a,departure_time:t,pickup_allowed:r.pickup_type? r.pickup_type==="0":true,dropoff_allowed:r.drop_off_type?r.drop_off_type==="0":true});
    const f=firstLast.get(r.trip_id);
    if(!f||seq<f.firstSeq)firstLast.set(r.trip_id,{firstSeq:seq,first:t,lastSeq:seq,last:a,route_id:tripById.get(r.trip_id).route_id});
    else if(seq>f.lastSeq){f.lastSeq=seq;f.last=a}
    if(timeBatch.length>=BATCH){await upsert("trip_stop_times",timeBatch,"trip_id,stop_sequence");timeBatch=[]}
    routeStopBatch.set(tripById.get(r.trip_id).route_id+"|"+seq,{route_id:tripById.get(r.trip_id).route_id,stop_id:r.stop_id,stop_sequence:seq});
    if(routeStopBatch.size>=BATCH){await upsert("transport_route_stops",[...routeStopBatch.values()],"route_id,stop_sequence");routeStopBatch.clear()}
  });
  await upsert("trip_stop_times",timeBatch,"trip_id,stop_sequence");
  // Deduplicate route-stop sequence rows across trips, keeping the same stop at the same sequence.
  await upsert("transport_route_stops",[...routeStopBatch.values()],"route_id,stop_sequence");
  const {error:assignError}=await db.rpc("mumove_assign_stop_operators");
  if(assignError)throw new Error("Could not map stop ownership: "+assignError.message);
  // Patch first/last schedule times in bounded upsert batches; overnight trips omit arrival.
  let updates=0,scheduleBatch=[];
  for(const [tripId,f] of firstLast){
    const trip=tripById.get(tripId);
    if(!trip)continue;
    scheduleBatch.push({id:tripId,route_id:trip.route_id,service_date:null,departure_time:f.first,arrival_time:f.last>=f.first?f.last:null,direction_label:null,calendar_ref:trip.service_id,source_ref:SOURCE,source_updated_at:new Date().toISOString(),verified_at:new Date().toISOString(),is_current:true});
    if(scheduleBatch.length>=BATCH){await upsert("scheduled_trips",scheduleBatch,"id");updates+=scheduleBatch.length;scheduleBatch=[]}
  }
  await upsert("scheduled_trips",scheduleBatch,"id");updates+=scheduleBatch.length;
  // Import optional GTFS v1 fare products/rules when present.
  const fareMap=new Map();
  await rows(archive,"fare_attributes.txt",async r=>{
    const op="best";
    const price=Number(r.price);
    if(!r.fare_id||!Number.isFinite(price)||price<0)return;
    fareMap.set(r.fare_id,{id:r.fare_id,operator_id:op,price,currency:r.currency_type||"INR",payment_method:r.payment_method?Number(r.payment_method):null,transfers:r.transfers?Number(r.transfers):null,source_ref:SOURCE,updated_at:new Date().toISOString()});
  });
  if(fareMap.size) await batchRows("transport_fare_products",(async function*(){yield* fareMap.values()})(),"id");
  await rows(archive,"fare_rules.txt",async r=>{
    if(!fareMap.has(r.fare_id))return;
    const {error}=await db.from("transport_fare_rules").upsert({fare_id:r.fare_id,route_id:r.route_id||null,origin_zone_id:r.origin_id||null,destination_zone_id:r.destination_id||null,contains_zone_id:r.contains_id||null},{onConflict:"id"});
    if(error && !/no unique|constraint/i.test(error.message))throw error;
  });
  await db.from("transport_operators").upsert(operators.map(o=>({...o,data_status:"static_schedule",updated_at:new Date().toISOString()})),{onConflict:"id"});
  const source={id:"best-community-gtfs",operator_id:null,name:"Community Mumbai GTFS (BEST/TMT/KDMT)",source_type:"gtfs",source_url:SOURCE,access_status:"connected",last_success_at:new Date().toISOString(),last_error:null,notes:"Imported public community-maintained static schedule. Not an official operator feed; service calendar checked for today/next 14 days.",updated_at:new Date().toISOString()};
  const {error:sourceError}=await db.from("transport_data_sources").upsert(source,{onConflict:"id"});
  if(sourceError)throw sourceError;
  console.log(JSON.stringify({source:SOURCE,activeServices:activeService.size,activeTrips:activeTrips.size,tripTimesImported:"batched",tripSchedulesUpdated:updates,fareProducts:fareMap.size},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{try{fs.unlinkSync(temp)}catch{}});
