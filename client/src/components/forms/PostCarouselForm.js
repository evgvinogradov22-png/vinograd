import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";
import { SlideImageUpload, FinalFileOrLink } from "./FileInputs";

function PostCarouselForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
  const { d, u } = useTaskForm(item, saveFnRef, onSave, {slides: item.slides?.length ? item.slides : [{id:genId(),text:"",img:"",img_name:""}]});
  const fileRef=useRef(null);
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"end"}}>
      <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={{...SI,width:140,colorScheme:"dark"}}/></Field>
    </div>
    <Field label="ТЕКСТ НА ОБЛОЖКЕ (слайд 1)"><input value={d.cover_text} onChange={e=>u("cover_text",e.target.value)} placeholder="Заголовок карусели..." style={SI}/></Field>
    <Field label="СЛАЙДЫ КАРУСЕЛИ">
      <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:6}}>
        {(d.slides||[]).map((sl,i)=>(
          <div key={sl.id||i} style={{display:"flex",gap:6,alignItems:"flex-start",background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:8,padding:"8px 10px"}}>
            <div style={{width:24,height:24,borderRadius:6,background:"#2d2d44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#9ca3af",flexShrink:0}}>{i+1}</div>
            <div style={{flex:1}}>
              <textarea value={sl.text} onChange={e=>u("slides",d.slides.map((s,j)=>j===i?{...s,text:e.target.value}:s))} placeholder={`Текст слайда ${i+1}...`} style={{...SI,minHeight:40,resize:"vertical",fontSize:11,lineHeight:1.4}}/>
              
              <SlideImageUpload slide={sl} idx={i} onUploaded={(url,name)=>u("slides",d.slides.map((s,j)=>j===i?{...s,img:url,img_name:name}:s))}/>
            </div>
            <button onClick={()=>u("slides",d.slides.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14,marginTop:2}}>×</button>
          </div>
        ))}
      </div>
      <button onClick={()=>u("slides",[...d.slides,{id:genId(),text:"",img:"",img_name:""}])} style={{background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"7px",color:"#9ca3af",cursor:"pointer",fontSize:11,width:"100%"}}>+ Добавить слайд</button>
      
    </Field>
    <TzField label="ТЗ ДЛЯ ДИЗАЙНЕРА" value={d.tz} onChange={v=>u("tz",v)} placeholder="Стиль, цвета, шрифты, особенности оформления..." minHeight={70}/>
    <Field label="ФИНАЛЬНАЯ ССЫЛКА"><div style={{display:"flex",gap:6,alignItems:"center"}}><input value={d.final_link} onChange={e=>u("final_link",e.target.value)} placeholder="https://..." style={{...SI,flex:1}}/>{d.final_link&&<a href={d.final_link} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#06b6d4",textDecoration:"none",flexShrink:0}}>↓ Открыть</a>}</div></Field>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.designer} onChange={v=>u("designer",v)} team={team}/></div>
      </div>
    </div>

    
  </div>;
}

export default PostCarouselForm;
