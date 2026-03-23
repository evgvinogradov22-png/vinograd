import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";
import { SourceInputs, FinalFileOrLink } from "./FileInputs";

function PostReelsForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
  const { d, u } = useTaskForm(item, saveFnRef, onSave, {sources: item.sources||[]});
  const [tr,setTr]=useState(false); const [gb,setGb]=useState(false);
  const [err,setErr]=useState("");
  const fileRef=useRef(null);
  async function transcribe(){
    const firstSrc=(d.sources&&d.sources[0])||null;
    const srcUrl=firstSrc?.url||d.source_url||"";
    if(!srcUrl){setErr("Сначала загрузите исходник");return;}
    setTr(true);setErr("");
    try{
      const fd=new FormData();
      const rb=await fetch(srcUrl);
      if(!rb.ok) throw new Error("Не удалось получить файл ("+rb.status+")");
      const blob=await rb.blob();
      if(blob.size===0) throw new Error("Файл пустой — возможно ошибка загрузки");
      const fname=firstSrc?.name||d.source_name||"video.mp4";
      fd.append("file",new File([blob],fname,{type:blob.type||"video/mp4"}));
      const r=await fetch("/api/ai/transcribe",{method:"POST",body:fd});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||"Ошибка транскрипции");
      u("transcript",data.text);
      setErr("");
    }catch(e){setErr("❌ "+e.message);}
    setTr(false);
  }
  async function genBirolls(){
    setGb(true);setErr("");
    try{
      const r=await fetch("/api/ai/birolls",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:d.transcript,title:d.title})});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"Ошибка");
      u("birolls",data.text);
    }catch(e){setErr("Биролы: "+e.message);}
    setGb(false);
  }
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
      <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={{...SI,width:140,colorScheme:"dark"}}/></Field>
    </div>
    <SourceInputs d={d} u={u}/>
    
    <TzField label="ТЗ ДЛЯ МОНТАЖЁРА" value={d.tz} onChange={v=>u("tz",v)} placeholder="Описание задачи..." minHeight={55}/>

    <FinalFileOrLink d={d} u={u} fileRef={fileRef}/>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.editor} onChange={v=>u("editor",v)} team={team}/></div>
      </div>
    </div>
    {d.status==="done"&&onSendToPub&&<button onClick={()=>onSendToPub(d)} style={{width:"100%",marginTop:4,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>🚀 Отправить на публикацию</button>}
    
  </div>;
}

export default PostReelsForm;
