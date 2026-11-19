import React,{useState} from "react";
import {Bot,Send,LoaderCircle,UserRound} from "lucide-react";
export default function AITravelAssistant(){
 const [message,setMessage]=useState(""),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function send(e){e?.preventDefault();const q=message.trim();if(!q||busy)return;setMessage("");setError("");const next=[...history,{role:"user",content:q}];setHistory(next);setBusy(true);
  try{const r=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,history})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Assistant unavailable");setHistory([...next,{role:"assistant",content:d.reply}]);}
  catch(err){setError(err.message)}finally{setBusy(false)}
 }
 return <section className="panel ai-assistant"><div className="panel-heading"><div><b><Bot size={17} style={{verticalAlign:"-4px",marginRight:7}}/>MUMOVE travel assistant</b><small>Answers grounded in connected MUMOVE data</small></div><span className="status-tag">AI beta</span></div>
 <div className="ai-prompts">{["How do I travel from Andheri to CSMT?","Find bus stops near Bandra","Are live train arrivals connected?"].map(q=><button key={q} onClick={()=>setMessage(q)}>{q}</button>)}</div>
 <div className="ai-messages">{history.map((m,i)=><div className={"ai-message "+m.role} key={i}><span>{m.role==="assistant"?<Bot size={15}/>:<UserRound size={15}/>}</span><p>{m.content}</p></div>)}{busy&&<div className="ai-wait"><LoaderCircle className="spin" size={16}/> Checking transport data…</div>}</div>
 {error&&<div className="notice">{error}</div>}
 <form className="ai-compose" onSubmit={send}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ask about a Mumbai journey…" maxLength={1200}/><button className="button primary" disabled={busy||!message.trim()} aria-label="Send message"><Send size={17}/></button></form>
 </section>
}
