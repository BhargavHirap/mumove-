import { createClient } from "@supabase/supabase-js";
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"POST required"});
  const expected=process.env.MUMOVE_INGEST_TOKEN;
  if(!expected||req.headers.authorization!=="Bearer "+expected)return res.status(401).json({error:"Unauthorised feed publisher"});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return res.status(503).json({error:"Server database credentials are not configured"});
  const body=req.body||{}, source=String(body.source_name||"Authorised operator feed").slice(0,120);
  const db=createClient(url,key,{auth:{persistSession:false}});
  const vehicles=Array.isArray(body.vehicles)?body.vehicles.slice(0,1000):[];
  const alerts=Array.isArray(body.alerts)?body.alerts.slice(0,200):[];
  const valid=vehicles.filter(v=>v.id&&v.operator_id&&Number.isFinite(+v.latitude)&&Number.isFinite(+v.longitude)&&Math.abs(+v.latitude)<=90&&Math.abs(+v.longitude)<=180&&v.recorded_at&&Date.now()-new Date(v.recorded_at).getTime()<180000);
  if(valid.length){const {error}=await db.from("transport_vehicle_positions").upsert(valid.map(v=>({id:String(v.id),operator_id:String(v.operator_id),route_id:v.route_id||null,latitude:+v.latitude,longitude:+v.longitude,bearing:v.bearing==null?null:+v.bearing,speed_kmh:v.speed_kmh==null?null:+v.speed_kmh,recorded_at:v.recorded_at,source_name:source,source_updated_at:v.source_updated_at||v.recorded_at,verified_at:new Date().toISOString()})),{onConflict:"id"});if(error)return res.status(400).json({error:error.message});}
  if(alerts.length){const {error}=await db.from("transport_service_alerts").insert(alerts.map(a=>({operator_id:a.operator_id||null,route_id:a.route_id||null,stop_id:a.stop_id||null,title:String(a.title||"Service update").slice(0,200),description:String(a.description||"").slice(0,2000),severity:["info","warning","severe"].includes(a.severity)?a.severity:"info",status:"active",starts_at:a.starts_at||new Date().toISOString(),ends_at:a.ends_at||null,source_name:source,source_url:a.source_url||null,source_updated_at:a.source_updated_at||new Date().toISOString(),verified_at:new Date().toISOString()})));if(error)return res.status(400).json({error:error.message});}
  return res.status(200).json({acceptedVehicles:valid.length,rejectedStaleOrInvalidVehicles:vehicles.length-valid.length,acceptedAlerts:alerts.length,source});
}
