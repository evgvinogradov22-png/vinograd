import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";
import { FinalFileOrLink } from "./FileInputs";

function PostVideoForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
  const { d, u } = useTaskForm(item, saveFnRef, onSave, {source_links: item.source_links||[]});
  const fileRef=useRef(null);
  function setLink(i,v){const a=[...d.source_links];a[i]=v;u("source_links",a);}
  function removeLink(i){u("source_links",d.source_links.filter((_,j)=>j!==i));}
  function addLink(){u("source_links",[...d.source_links,""]);}
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
      <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={{...SI,width:140,colorScheme:"dark"}}/></Field>
    </div>
    <Field label="КОЛ-ВО ИТОГОВЫХ ВИДЕО"><input type="number" min="1" value={d.video_count||1} onChange={e=>u("video_count",parseInt(e.target.value)||1)} style={{...SI,width:100}}/></Field>
    <TzField label="ТЗ ДЛЯ МОНТАЖЁРА" value={d.tz} onChange={v=>u("tz",v)} placeholder="Подробное ТЗ..." minHeight={100}/>
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

export default PostVideoForm;
