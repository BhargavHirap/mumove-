import { createClient } from "@supabase/supabase-js";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
export default async function handler(req,res){
  Object.entries(cors).forEach(([k,v])=>res.setHeader(k,v));
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  const {message,history=[]}=req.body||{};
  if(typeof message!=="string"||!message.trim()||message.length>1200)return res.status(400).json({error:"Enter a question (maximum 1,200 characters)."});
  const key=process.env.MUMOVE_OPENAI_API_KEY;
  if(!key)return res.status(503).json({error:"The AI assistant needs an AI provider key. Add MUMOVE_OPENAI_API_KEY to Vercel environment variables; no key is embedded in the app."});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  let context="No verified timetable, fare or live vehicle data is currently connected.";
  if(url&&service){
    const db=createClient(url,service,{auth:{persistSession:false}});
    const term=message.split(/\s+/).filter(x=>x.length>2).slice(0,3).join(" ");
    if(term){
      const {data}=await db.rpc("mumove_search_stops",{search_term:term,result_limit:8});
      if(data?.length)context="Matching database stops (static records): "+JSON.stringify(data.map(x=>({name:x.name,mode:x.stop_type,operator:x.operator_id})));
    }
    const {data:alerts}=await db.from("transport_service_alerts").select("title,description,severity,source_name,source_updated_at").eq("status","active").limit(8);
    if(alerts?.length)context+="\nCurrent imported service alerts: "+JSON.stringify(alerts);
  }
  const prior=Array.isArray(history)?history.filter(x=>["user","assistant"].includes(x.role)&&typeof x.content==="string").slice(-8).map(x=>({role:x.role,content:x.content.slice(0,1000)})):[];
  const response=await fetch(process.env.MUMOVE_AI_ENDPOINT||"https://api.openai.com/v1/chat/completions",{
    method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({model:process.env.MUMOVE_AI_MODEL||"gpt-4o-mini",temperature:0.2,messages:[
      {role:"system",content:"You are MUMOVE, a careful Mumbai public-transport travel assistant. Help plan journeys and explain transport options. Use only the supplied database context for claims about actual stops, schedules, fares, service alerts or live positions. Clearly distinguish static schedules from real-time data. Never invent a train/bus departure, fare, platform, vehicle location, ticket availability or operator integration. If the supplied context lacks a timetable/fare/feed, say it is not connected and point the commuter to the relevant operator. Give concise step-by-step directions. Current database context:\n"+context},
      ...prior,{role:"user",content:message.trim()}
    ]})
  });
  const data=await response.json();
  if(!response.ok)return res.status(502).json({error:data?.error?.message||"AI provider request failed."});
  return res.status(200).json({reply:data.choices?.[0]?.message?.content||"I couldn't prepare an answer. Please try again."});
}
