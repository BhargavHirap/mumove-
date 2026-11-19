import React,{useEffect} from "react";
import {MapContainer,TileLayer,Polyline,CircleMarker,Popup,useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
function Fit({paths}){const map=useMap();useEffect(()=>{const pts=paths.flat();if(pts.length>1)map.fitBounds(L.latLngBounds(pts),{padding:[28,28],maxZoom:14});else if(pts.length===1)map.setView(pts[0],13)},[map,paths]);return null}
export default function JourneyRoutesMap({journeys=[]}){
 const paths=journeys.flatMap(j=>j.legs.map(l=>l.path||[]).filter(p=>p.length>1));
 if(!paths.length)return <div className="journey-map-empty">A route map will appear when the selected journey has stop coordinates in the imported timetable.</div>;
 const first=paths[0];
 return <section className="journey-map-card">
  <div className="journey-map-title"><b>Journey route map</b><small>{paths.length} mapped segment(s) across the available options</small></div>
  <div className="journey-map-canvas"><MapContainer center={first[0]} zoom={11} scrollWheelZoom={false}>
   <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
   {paths.map((path,i)=><Polyline key={i} positions={path} pathOptions={{color:["#2C365A","#596B52","#9B7653","#77718D","#477B83","#A15C52"][i%6],weight:i===0?6:4,opacity:i===0?0.9:0.48,dashArray:i===0?undefined:"7 7"}}/>)}
   <CircleMarker center={first[0]} radius={7} pathOptions={{color:"#F8F5F0",weight:3,fillColor:"#596B52",fillOpacity:1}}><Popup>Journey start</Popup></CircleMarker>
   <CircleMarker center={first[first.length-1]} radius={7} pathOptions={{color:"#F8F5F0",weight:3,fillColor:"#2C365A",fillOpacity:1}}><Popup>Journey destination</Popup></CircleMarker>
   <Fit paths={paths}/>
  </MapContainer></div>
  <p>Lines connect imported GTFS stop coordinates in sequence. They are indicative stop-to-stop paths, not official road or rail track geometry. Different colours show different journey segments/options.</p>
 </section>
}
