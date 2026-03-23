import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";
import { ReelStatsBlock } from "./ReelStats";

function PubForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const { d, u } = useTaskForm(item, saveFnRef, onSave);
  const [aiCap,setAiCap]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef(null);
  async function genCap(){
    setAiCap(true);
    try{
      const proj=projects.find(p=>p.id===d.project);
      const r=await fetch("/api/ai/caption",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:d.title,project_label:proj?.label||""})});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||"Ошибка");
      u("caption",data.text);
    }catch(e){alert("AI caption: "+e.message);}
    setAiCap(false);
  }
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="ТИП ПУБЛИКАЦИИ"><select value={d.pub_type||"video"} onChange={e=>u("pub_type",e.target.value)} style={SI}>
        <option value="video">🎬 Видео / Рилс</option>
        <option value="carousel">🖼 Карусель</option>
      </select></Field>
      {(d.pub_type||"video")!=="carousel"&&<Field label="КОЛ-ВО РИЛС">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>u("reels_count",Math.max(1,(d.reels_count||1)-1))} style={{width:28,height:28,background:"#1e1e2e",border:"1px solid #2d2d44",borderRadius:6,color:"#f0eee8",cursor:"pointer",fontSize:14,flexShrink:0}}>−</button>
          <input type="number" min="1" max="99" value={d.reels_count||1} onChange={e=>u("reels_count",Math.max(1,parseInt(e.target.value)||1))} style={{...SI,width:60,textAlign:"center",fontWeight:700,fontSize:14}}/>
          <button onClick={()=>u("reels_count",Math.min(99,(d.reels_count||1)+1))} style={{width:28,height:28,background:"#1e1e2e",border:"1px solid #2d2d44",borderRadius:6,color:"#f0eee8",cursor:"pointer",fontSize:14,flexShrink:0}}>+</button>
          {(d.reels_count||1)>1&&<span style={{fontSize:10,color:"#a78bfa",fontFamily:"monospace"}}>× {d.reels_count} рилса в публикации</span>}
        </div>
      </Field>}
    </div>
    <StatusRow statuses={PUB_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <Field label="ДАТА ПУБЛИКАЦИИ"><input type="datetime-local" value={d.planned_date} onChange={e=>u("planned_date",e.target.value)} style={SI}/></Field>
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={LB}>ПОДПИСЬ / CAPTION</span>
        <Btn onClick={genCap} disabled={aiCap} color="#10b981">{aiCap?"⏳ Генерирую...":"✨ AI caption"}</Btn>
      </div>
      <textarea value={d.caption} onChange={e=>u("caption",e.target.value)} placeholder="Текст публикации..." style={{...SI,minHeight:90,resize:"vertical",lineHeight:1.5}}/>
      <div style={{fontSize:9,color:"#6b7280",marginTop:2,fontFamily:"monospace"}}>{d.caption.length} символов</div>
    </div>
    <Field label="ХЕШТЕГИ"><textarea value={d.hashtags} onChange={e=>u("hashtags",e.target.value)} placeholder="#хештег1 #хештег2" style={{...SI,minHeight:45,resize:"vertical",fontFamily:"monospace",fontSize:11}}/></Field>
    <Field label="ФАЙЛ / МЕДИА">
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={async e=>{
        const f=e.target.files[0]; if(!f) return;
        u("file_name",f.name); setUploading(true); setUploadProgress(0);
        try {
          const {url, key} = await xhrUpload(f, p=>setUploadProgress(p));
          u("file_url", url);
          u("file_key", key);
        } catch(err) { alert("Ошибка загрузки: "+err.message); }
        setUploading(false);
      }}/>
      {uploading&&<div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:8,padding:"10px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:11,color:"#9ca3af"}}>{d.file_name}</span>
          <span style={{fontSize:11,color:"#06b6d4",fontFamily:"monospace",fontWeight:700}}>{uploadProgress}%</span>
        </div>
        <div style={{background:"#1e1e2e",borderRadius:4,height:6,overflow:"hidden"}}>
          <div style={{width:`${uploadProgress}%`,height:"100%",background:"linear-gradient(90deg,#06b6d4,#8b5cf6)",borderRadius:4,transition:"width 0.1s"}}/>
        </div>
      </div>}
      {!uploading&&d.file_name
        ?<div style={{background:"#0a1a0a",border:"1px solid #10b98130",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
            <span>📎</span><span style={{fontSize:12,color:"#10b981",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.file_name}</span>
            {d.file_url&&<a href={fileHref(d.file_url, d.file_key, d.file_name)} target="_blank" rel="noreferrer" style={{background:"#06b6d420",border:"1px solid #06b6d440",borderRadius:6,padding:"3px 10px",fontSize:11,color:"#06b6d4",textDecoration:"none",fontWeight:700,whiteSpace:"nowrap"}}>⬇ Скачать</a>}
            <button onClick={()=>{u("file_name","");u("file_url","");}} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}>×</button>
          </div>
        :!uploading&&<button onClick={()=>fileRef.current?.click()} style={{width:"100%",background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"10px",color:"#9ca3af",cursor:"pointer",fontSize:12}}>📎 Прикрепить фото / видео</button>}
    </Field>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.executor||""} onChange={v=>u("executor",v)} team={team}/></div>
      </div>
    </div>
    {d.pub_type!=="carousel"&&<ReelStatsBlock
      taskId={d.id}
      reelUrls={(() => {
        const cnt = Math.max(1, parseInt(d.reels_count)||1);
        if (Array.isArray(d.reel_urls) && d.reel_urls.length >= cnt) return d.reel_urls;
        return Array.from({length:cnt}, (_,i) => d[i===0?"reel_url":`reel_url_${i}`]||"");
      })()}
      reelsCount={Math.max(1, parseInt(d.reels_count)||1)}
      onUrlSave={urls => { u("reel_urls", urls); u("reel_url", urls[0]||""); }}
    />}
    
    {d.status==="done"&&onSendToPub&&<button onClick={()=>onSendToPub(d)} style={{width:"100%",marginTop:4,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>🚀 Отправить на публикацию</button>}
  </div>;
}

export default PubForm;
