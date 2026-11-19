import React,{useEffect,useMemo} from "react";
import {MapContainer,TileLayer,Marker,Popup,useMap} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pointIcon=L.divIcon({className:"mumove-map-marker-wrap",html:'<span class="mumove-map-marker"><i></i></span>',iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-13]});
const userIcon=L.divIcon({className:"mumove-map-user-wrap",html:'<span class="mumove-map-user"><i></i></span>',iconSize:[30,30],iconAnchor:[15,15]});
function MapViewport({points,location}){
 const map=useMap();
 useEffect(()=>{
  const coords=[...(location?[[location.lat,location.lng]]:[]),...points.map(p=>[p.lat,p.lng])];
  if(coords.length>1)map.fitBounds(L.latLngBounds(coords),{padding:[32,32],maxZoom:15});
  else if(coords.length===1)map.setView(coords[0],14);
 },[map,points,location]);
 return null;
}
export default function NearbyMap({stops=[],location=null}){
 const valid=useMemo(()=>stops.filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng))),[stops]);
 const center=location?[location.lat,location.lng]:valid.length?[valid[0].lat,valid[0].lng]:[19.076,72.8777];
 return <section className="mumove-map-section">
  <div className="mumove-map-heading"><div><b>Explore the map</b><small>{valid.length} mapped stops shown · OpenStreetMap</small></div><span className="mumove-map-key"><i/> Transport stop</span></div>
  <div className="mumove-live-map" aria-label="Interactive map of nearby public transport stops">
   <MapContainer center={center} zoom={location||valid.length?13:11} scrollWheelZoom={false} zoomControl={true}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
    {location&&<Marker position={[location.lat,location.lng]} icon={userIcon}><Popup>Your current location</Popup></Marker>}
    {valid.map(s=><Marker key={s.id||s.name+":"+s.lat+":"+s.lng} position={[s.lat,s.lng]} icon={pointIcon}><Popup><b>{s.name}</b><br/>{s.type}{s.operator?" · "+s.operator:""}<br/>{Number.isFinite(s.distance)?s.distance.toFixed(1)+" km away":""}</Popup></Marker>)}
    <MapViewport points={valid} location={location}/>
   </MapContainer>
  </div>
  <p className="mumove-map-disclaimer">Map tiles © OpenStreetMap contributors. Stops are from MUMOVE's imported dataset; map markers do not indicate live vehicle positions.</p>
 </section>;
}
