import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";

function PreForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const { d, u } = useTaskForm(item, saveFnRef, onSave, {refs: item.refs||[]});
  const [ai,setAi]=useState(false); const [newRef,setNewRef]=useState("");
  async function genScript(){
    setAi(true);
    try{
      const r=await fetch("/api/ai/script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({brief:d.brief,title:d.title})});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"Ошибка");
      u("script",data.text);
    }catch(e){alert("AI сценарий: "+e.message);}
    setAi(false);
  }
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ТИП КОНТЕНТА"><input value={d.type} onChange={e=>u("type",e.target.value)} placeholder="Рилс, Клип..." style={SI}/></Field>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.deadline} onChange={e=>u("deadline",e.target.value)} style={{...SI,colorScheme:"dark"}}/></Field>
    </div>
    <StatusRow statuses={PRE_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <Field label="БРИФ / ИДЕЯ"><textarea value={d.brief} onChange={e=>u("brief",e.target.value)} placeholder="Идея, ЦА, месседж..." style={{...SI,minHeight:65,resize:"vertical",lineHeight:1.5}}/></Field>
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={LB}>СЦЕНАРИЙ</span>
        <Btn onClick={genScript} disabled={ai||!d.brief}>{ai?"⏳ Генерирую...":"✨ AI сценарий"}</Btn>
      </div>
      <textarea value={d.script} onChange={e=>u("script",e.target.value)} placeholder="По сценам..." style={{...SI,minHeight:90,resize:"vertical",lineHeight:1.5}}/>
    </div>
    <Field label="РЕФЕРЕНСЫ">
      <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:5}}>
        {d.refs.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:6,padding:"4px 9px"}}>
          <a href={r} target="_blank" rel="noreferrer" style={{flex:1,fontSize:11,color:"#a78bfa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {r}</a>
          <button onClick={()=>u("refs",d.refs.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}>×</button>
        </div>)}
      </div>
      <div style={{display:"flex",gap:5}}>
        <input value={newRef} onChange={e=>setNewRef(e.target.value)} placeholder="https://..." style={{...SI,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&newRef){u("refs",[...d.refs,newRef]);setNewRef("");}}}/>
        <button onClick={()=>{if(newRef){u("refs",[...d.refs,newRef]);setNewRef("");}}} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:7,padding:"0 11px",color:"#a78bfa",cursor:"pointer",fontSize:16}}>+</button>
      </div>
    </Field>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.scriptwriter} onChange={v=>u("scriptwriter",v)} team={team}/></div>
      </div>
    </div>

    
  </div>;
}

export default PreForm;
