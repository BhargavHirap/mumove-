import React,{useEffect} from "react";
import {MapContainer,TileLayer,Polyline,CircleMarker,Popup,ScaleControl,ZoomControl,useMap} from "react-leaflet";
import L from "leaflet";
import {MapPin} from "lucide-react";
import "leaflet/dist/leaflet.css";

const COLORS=["#36c5d9","#ffbf69","#a996ff","#57d6b1","#ff7e79","#7da8ff"];
function Fit({paths}) {
 const map=useMap();
 useEffect(()=>{
  const pts=paths.flat();
  if(pts.length>1) map.fitBounds(L.latLngBounds(pts),{padding:[36,36],maxZoom:15});
  else if(pts.length===1) map.setView(pts[0],14);
 },[map,paths]);
 return null;
}
export default function JourneyRoutesMap({journeys=[]}) {
 const options=journeys.map(j=>j.legs.map(l=>l.path||[]).filter(p=>p.length>1)).filter(group=>group.length);
 const paths=options.flat();
 if(!paths.length) return <div className="journey-map-empty">Journey options were found, but this timetable feed does not include enough stop coordinates to draw a route.</div>;
 const first=paths[0];
 return <section className="journey-map-card">
  <div className="journey-map-title"><b>Journey map</b><small>{options.length} option(s) · OpenStreetMap</small></div>
  <div className="journey-map-canvas">
   <MapContainer center={first[0]} zoom={11} scrollWheelZoom={true} zoomControl={false} preferCanvas={true}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>
    <ZoomControl position="topright"/>
    <ScaleControl position="bottomleft" metric={true} imperial={false}/>
    {options.map((segments,i)=>segments.map((path,n)=><Polyline key={i+"-"+n} positions={path} pathOptions={{color:COLORS[i%COLORS.length],weight:i===0?6:4,opacity:i===0?.95:.65,dashArray:i===0?undefined:"8 7"}}/>))}
    {options.map((segments,i)=>{const start=segments[0][0],last=segments[segments.length-1],end=last[last.length-1];return <React.Fragment key={"markers-"+i}><CircleMarker center={start} radius={i===0?8:6} pathOptions={{color:"#0d1422",weight:3,fillColor:COLORS[i%COLORS.length],fillOpacity:1}}><Popup>Option {i+1} · start</Popup></CircleMarker><CircleMarker center={end} radius={i===0?8:6} pathOptions={{color:"#0d1422",weight:3,fillColor:COLORS[i%COLORS.length],fillOpacity:1}}><Popup>Option {i+1} · destination</Popup></CircleMarker></React.Fragment>})}
    <Fit paths={paths}/>
   </MapContainer>
  </div>
  <div className="journey-map-legend">{options.map((_,i)=><span key={i}><i style={{background:COLORS[i%COLORS.length]}}/>Option {i+1}</span>)}</div>
  <p>Route lines follow imported timetable stop coordinates. They are indicative stop-to-stop paths, not surveyed track geometry. Options are drawn from the operator feeds available in MUMOVE.</p>
 </section>;
}
