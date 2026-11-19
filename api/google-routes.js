export default async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Method not allowed"})}
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key)return res.status(503).json({error:"Google Routes API is not configured. Add GOOGLE_MAPS_API_KEY in Vercel."});
 try{
  const {origin,destination}=req.body||{};
  if(!origin||!destination)return res.status(400).json({error:"Origin and destination are required."});
  const response=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.travelMode,routes.legs.steps.transitDetails,routes.travelAdvisory.transitFare"},body:JSON.stringify({origin:{address:origin},destination:{address:destination},travelMode:"TRANSIT",computeAlternativeRoutes:true,languageCode:"en-IN",units:"METRIC"})});
  const data=await response.json();
  if(!response.ok)return res.status(response.status).json({error:data.error?.message||"Google Routes request failed."});
  return res.status(200).json({routes:data.routes||[],source:"Google Routes API",disclaimer:"Transit options depend on Google's available public transport data for this area and time. Verify operator schedules before travel."});
 }catch(e){return res.status(500).json({error:e.message||"Unable to calculate Google transit routes."})}
}
