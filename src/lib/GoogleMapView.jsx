import React,{useEffect,useRef,useState} from "react";
let loader;
function loadGoogleMaps(key){
 if(window.google?.maps)return Promise.resolve(window.google.maps);
 if(!loader){loader=new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-mumove-google-maps]');if(existing){existing.addEventListener("load",()=>resolve(window.google.maps));existing.addEventListener("error",reject);return}const s=document.createElement("script");s.dataset.mumoveGoogleMaps="true";s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&v=weekly";s.async=true;s.onload=()=>resolve(window.google.maps);s.onerror=()=>reject(new Error("Google Maps could not load. Check the API key and enabled Maps JavaScript API."));document.head.appendChild(s)})}
 return loader;
}
export default function GoogleMapView({markers=[],paths=[],location=null,zoom=12}){
 const host=useRef(null),mapRef=useRef(null),[error,setError]=useState("");
 const key=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
 useEffect(()=>{let alive=true;if(!key){setError("Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY in Vercel.");return}
 loadGoogleMaps(key).then(maps=>{if(!alive||!host.current)return;
 const coords=[...markers.map(m=>({lat:Number(m.lat),lng:Number(m.lng)})),...paths.flat().map(p=>({lat:Number(p[0]),lng:Number(p[1])})),...(location?[{lat:location.lat,lng:location.lng}]:[])].filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
 const center=location||coords[0]||{lat:19.076,lng:72.8777};
 const map=new maps.Map(host.current,{center,zoom,mapTypeControl:false,streetViewControl:false,fullscreenControl:true,clickableIcons:true,gestureHandling:"greedy",mapId:undefined});
 mapRef.current=map;const bounds=new maps.LatLngBounds();
 markers.forEach(m=>{const p={lat:Number(m.lat),lng:Number(m.lng)};if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return;const marker=new maps.Marker({position:p,map,title:m.name||"Transport stop"});if(m.name){const info=new maps.InfoWindow({content:"<strong>"+String(m.name).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+"</strong>"+(m.type?"<br>"+m.type:"")});marker.addListener("click",()=>info.open({map,anchor:marker}))}bounds.extend(p)});
 paths.forEach((path,i)=>{if(path.length<2)return;const line=new maps.Polyline({path:path.map(p=>({lat:p[0],lng:p[1]})),geodesic:true,strokeColor:["#2C365A","#596B52","#9B7653","#77718D","#477B83"][i%5],strokeOpacity:i===0?.95:.62,strokeWeight:i===0?6:4,map});path.forEach(p=>bounds.extend({lat:p[0],lng:p[1]}))});
 if(location){const p={lat:location.lat,lng:location.lng};new maps.Marker({position:p,map,title:"Your location",icon:{path:maps.SymbolPath.CIRCLE,scale:8,fillColor:"#596B52",fillOpacity:1,strokeColor:"#fff",strokeWeight:3}});bounds.extend(p)}
 if(coords.length>1)map.fitBounds(bounds,{top:28,right:28,bottom:28,left:28});else if(coords.length===1)map.setCenter(coords[0]);
 }).catch(e=>alive&&setError(e.message||"Google Maps unavailable"));return()=>{alive=false}},[key,markers,paths,location]);
 return <div className="mumove-google-map-wrap"><div ref={host} className="mumove-google-map" aria-label="Google map of MUMOVE transport data"/>{error&&<div className="mumove-map-key-notice">{error} OpenStreetMap remains available below until Google Maps is configured.</div>}</div>
}
