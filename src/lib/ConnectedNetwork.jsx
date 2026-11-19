import React,{useEffect,useState} from "react";
import {Activity,AlertTriangle,Bus,Clock3,Radio,RefreshCw,Train} from "lucide-react";
import {hasSupabase,supabase} from "./supabase";

const MODE_LABEL={bus:"BEST / bus",suburban_rail:"Local rail",metro:"Metro",ferry:"Ferry"};
function age(value){if(!value)return "Time not supplied";const mins=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/60000));return mins<1?"just now":mins<60?mins+" min ago":Math.round(mins/60)+" hr ago";}
export default function ConnectedNetwork({mode}){
 const [data,setData]=useState({operators:[],routes:[],stops:[],alerts:[],vehicles:[],trips:0,loading:true,error:""});
 const [updated,setUpdated]=useState(null);
 async function load(){
  if(!hasSupabase){setData(x=>({...x,loading:false,error:"Connect Supabase to load the shared transport network."}));return}
  setData(x=>({...x,loading:true,error:""}));
  const [o,r,s,a,v,t]=await Promise.all([
   supabase.from("transport_operators").select("id,name,mode,data_status").order("name"),
   supabase.from("transport_routes").select("id,operator_id,route_short_name,route_long_name,mode,active").eq("active",true).limit(500),
   supabase.from("transport_stops").select("id,operator_id,name,stop_type,latitude,longitude").limit(1000),
   supabase.from("transport_service_alerts").select("id,operator_id,title,description,severity,source_name,source_url,source_updated_at,starts_at").eq("status","active").order("starts_at",{ascending:false}).limit(20),
   supabase.from("transport_vehicle_positions").select("id,operator_id,route_id,latitude,longitude,recorded_at,source_name").gte("recorded_at",new Date(Date.now()-3*60*1000).toISOString()).order("recorded_at",{ascending:false}).limit(100),
   supabase.from("scheduled_trips").select("id",{count:"exact",head:true}).eq("is_current",true)
  ]);
  const errors=[o,r,s,a,v,t].filter(x=>x.error).map(x=>x.error.message);
  setData({operators:o.data||[],routes:r.data||[],stops:s.data||[],alerts:a.data||[],vehicles:v.data||[],trips:t.count||0,loading:false,error:errors.join(" · ")});
  setUpdated(new Date());
 }
 useEffect(()=>{load();if(!hasSupabase)return;const channel=supabase.channel("mumove-network-"+(mode||"all")).on("postgres_changes",{event:"*",schema:"public",table:"transport_service_alerts"},load).on("postgres_changes",{event:"*",schema:"public",table:"transport_vehicle_positions"},load).subscribe();return()=>{supabase.removeChannel(channel)}},[mode]);
 const operators=data.operators.filter(x=>!mode||x.mode===mode);
 const ids=new Set(operators.map(x=>x.id));
 const routes=data.routes.filter(x=>(!mode||x.mode===mode)&&(!mode||ids.has(x.operator_id)));
 const stops=data.stops.filter(x=>!mode||ids.has(x.operator_id));
 const alerts=data.alerts.filter(x=>!mode||!x.operator_id||ids.has(x.operator_id));
 const vehicles=data.vehicles.filter(x=>!mode||ids.has(x.operator_id));
 const label=mode?MODE_LABEL[mode]||mode:"Mumbai transport network";
 return <section className="panel connected-panel"><div className="panel-heading"><div><b><Radio size={15} style={{display:"inline",verticalAlign:"-3px",marginRight:7,color:"#57d6b1"}}/>Connected network · {label}</b><small>{data.loading?"Syncing shared operator data…":updated?"Database sync · "+updated.toLocaleTimeString():"Transport data status"}</small></div><button className="icon-button" onClick={load} disabled={data.loading} aria-label="Refresh transport data"><RefreshCw size={16} className={data.loading?"spin":""}/></button></div>
 {!hasSupabase?<div className="notice">Supabase is not configured. Add the project URL and publishable key in Vercel environment variables.</div>:null}
 {data.error?<div className="notice"><AlertTriangle size={16}/>{data.error}</div>:null}
 <div className="network-stats"><div><b>{operators.length}</b><small>Operators</small></div><div><b>{routes.length}</b><small>Routes</small></div><div><b>{stops.length}</b><small>Stops</small></div><div><b>{vehicles.length}</b><small>Fresh live vehicles</small></div></div>
 <div className="network-status">{operators.map(op=><span key={op.id} className={"network-chip "+op.data_status}><i/>{op.name}</span>)}</div>
 {routes.length>0?<div className="network-list"><b>Imported routes</b>{routes.slice(0,8).map(route=><article className="info-row" key={route.id}><div className="row-icon">{route.mode==="bus"?<Bus size={17}/>:<Train size={17}/>}</div><div className="row-text"><b>{route.route_short_name?route.route_short_name+" · ":""}{route.route_long_name}</b><small>{MODE_LABEL[route.mode]||route.mode}</small></div></article>)}</div>:<div className="network-empty"><b>{data.loading?"Checking imported services…":"No verified route records imported yet"}</b><span>Operator links are references, not live connections. Routes and departures appear here only after a feed is validated and imported.</span></div>}
 {alerts.length>0&&<div className="network-list"><b>Operator service alerts</b>{alerts.slice(0,5).map(a=><article className="info-row" key={a.id}><div className="row-icon"><AlertTriangle size={17}/></div><div className="row-text"><b>{a.title}</b><span>{a.description}</span><small>{a.source_name} · {age(a.source_updated_at||a.starts_at)} {a.source_url?"· source linked":""}</small></div><span className="status-tag">{a.severity}</span></article>)}</div>}
 {vehicles.length>0&&<div className="network-live"><Activity size={15}/> {vehicles.length} vehicle positions received in the last 3 minutes · source timestamps shown on refresh.</div>}
 {!data.loading&&data.trips===0&&<small className="network-footnote">No scheduled trips have been imported. Timetable/ETA is not available yet; no departure is fabricated.</small>}
 </section>;
}
