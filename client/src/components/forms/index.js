import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";

function FinalFileOrLink({d,u,fileRef}){
  const _ownRef=useRef(null);
  const fRef=fileRef||_ownRef;
  const [uploading,setUploading]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  return <div>
    <span style={LB}>ФИНАЛЬНОЕ ВИДЕО</span>

    <>
      <input ref={fRef} type="file" accept="video/*,audio/*" style={{display:"none"}} onChange={async e=>{
        const f=e.target.files[0]; if(!f) return;
        setUploading(true); setUploadProgress(0); u("final_file_name",f.name); u("final_file_url","");
        try{
          const {url, key} = await xhrUpload(f, p=>setUploadProgress(p));
          u("final_file_url", url);
          u("final_file_key", key);
        }catch(e){alert("Ошибка: "+e.message);}
        setUploading(false); e.target.value="";
      }}/>
      {uploading
        ? <UploadProgress progress={uploadProgress} fileName={d.final_file_name}/>
        : d.final_file_name
          ? <div style={{background:"#0a1a0a",border:"1px solid #10b98130",borderRadius:8,overflow:"hidden"}}>
              <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                <span>🎬</span>
                <span style={{flex:1,fontSize:11,color:"#10b981",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.final_file_name}</span>
                {d.final_file_url
                  ? <a
                      href={(()=>{const c=cleanR2Url(d.final_file_url||"");return isR2Url(c)?c:fileHref(d.final_file_url,d.final_file_key,d.final_file_name);})()}
                      target="_blank" rel="noreferrer"
                      style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:5,textDecoration:"none",display:"inline-block"}}>↓ Скачать</a>
                  : <span style={{fontSize:9,color:"#f59e0b"}}>⏳</span>}
                <button onClick={()=>{u("final_file_name","");u("final_file_url","");}} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16}}>×</button>
              </div>
              {d.final_file_url&&/\.(mp4|mov|webm|avi|mkv)$/i.test(d.final_file_name)&&
                <video controls style={{width:"100%",maxHeight:320,display:"block",background:"#000"}} preload="metadata">
                  <source src={d.final_file_url}/>
                </video>}
            </div>
          : <button onClick={()=>fRef.current?.click()} style={{width:"100%",background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"12px",color:"#9ca3af",cursor:"pointer",fontSize:12}}>📤 Загрузить финальное видео</button>
      }
    </>
  </div>;
}

function SourceInputs({d, u}){
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingName, setUploadingName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef(null);
  const sources = (d.sources||[]).length>0
    ? d.sources.map(s=>({...s, url:cleanR2Url(s.url)}))
    : (d.source_name ? [{name:d.source_name, url:cleanR2Url(d.source_url||"")}] : []);

  async function addFile(e) {
    const files = Array.from(e.target.files); e.target.value = "";
    if (!files.length) return;
    setUploadErr("");
    for (const f of files) {
      try {
        setUploading(true); setUploadProgress(0); setUploadingName(f.name);
        const {url: dlurl, key: dlkey} = await xhrUpload(f, p=>setUploadProgress(p));
        const newSources = [...sources, {name:f.name, url:dlurl, key:dlkey}];
        u("sources", newSources);
        if (newSources.length === 1) { u("source_name", f.name); u("source_url", dlurl); }
      } catch(e) { setUploadErr(e.message); }
      setUploading(false);
    }
    setUploading(false);
  }

  function removeSource(i) {
    const newSources = sources.filter((_,j)=>j!==i);
    u("sources", newSources);
    if (newSources.length === 0) { u("source_name",""); u("source_url",""); u("source_link",""); }
    else { u("source_name", newSources[0].name); u("source_url", newSources[0].url||""); }
  }

  return <div>
    <span style={LB}>ИСХОДНИК (ВИДЕО)</span>
    {/* Existing sources */}
    {sources.map((s,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#0a1a0a",border:"1px solid #10b98130",borderRadius:7,padding:"6px 10px",marginBottom:5}}>
        <span>{s.url&&s.url.startsWith("http")?"🔗":"📁"}</span>
        <span style={{flex:1,fontSize:11,color:"#10b981",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
        {s.url&&(()=>{
          const clean = cleanR2Url(s.url||"");
          const r2 = isR2Url(clean);
          return <a href={r2 ? clean : clean} target="_blank" rel="noreferrer"
            download={r2 ? (s.name||"file") : undefined}
            style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,textDecoration:"none",display:"inline-block"}}>{r2?"↓":"🔗"}</a>;
        })()}
        <button onClick={()=>removeSource(i)} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14}}>×</button>
      </div>
    ))}
    {/* Upload progress */}
    {uploading&&<UploadProgress progress={uploadProgress} fileName={uploadingName}/>}
    {uploadErr&&<div style={{fontSize:10,color:"#ef4444",marginTop:4}}>{uploadErr}</div>}
    {/* Add file */}
    {!uploading&&<>
      <input ref={fileRef} type="file" accept="video/*,audio/*" multiple style={{display:"none"}} onChange={addFile}/>
      <button onClick={()=>fileRef.current?.click()} style={{width:"100%",background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontSize:12,marginBottom:5}}>{"📤 "+(sources.length?"+ Ещё файл":"Загрузить исходник")}</button>
    </>}
  </div>;
}

function SlideImageUpload({slide,idx,onUploaded}){
  const [loading,setLoading]=useState(false);
  const ref=useRef(null);
  async function handle(e){
    const f=e.target.files[0]; if(!f) return;
    setLoading(true);
    try{
      const {url, key} = await xhrUpload(f, ()=>{});
      onUploaded(url, f.name, key);
    }catch(err){alert("Ошибка: "+err.message);}
    setLoading(false); e.target.value="";
  }
  return <div style={{marginTop:4}}>
    <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handle}/>
    {slide.img
      ?<div style={{position:"relative",display:"inline-block",marginTop:4}}>
          <img src={slide.img} alt="" style={{maxWidth:"100%",maxHeight:120,borderRadius:6,border:"1px solid #2d2d44",display:"block"}}/>
          <div style={{display:"flex",gap:4,marginTop:3}}>
            <a href={slide.img} download={slide.img_name||"slide.jpg"} style={{fontSize:9,color:"#06b6d4",textDecoration:"none"}}>⬇ Скачать</a>
            <button onClick={()=>onUploaded("","")} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:9}}>× Удалить</button>
          </div>
        </div>
      :<button onClick={()=>ref.current?.click()} disabled={loading} style={{background:"transparent",border:"1px dashed #2d2d44",borderRadius:5,padding:"3px 10px",color:loading?"#f59e0b":"#4b5563",cursor:"pointer",fontSize:9,marginTop:3}}>{loading?"⏳ Загрузка...":"🖼 Загрузить изображение"}</button>}
  </div>;
}

function PreForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item,refs:item.refs||[]}); const [ai,setAi]=useState(false); const [newRef,setNewRef]=useState("");
  const _dRef1=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; _dRef1.current=next; return next; });
  useEffect(()=>{ _dRef1.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(_dRef1.current); },[d]);
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

function ProdForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item,checklist:[...(item.checklist||[])],equipment:[...(item.equipment||[])],actors:[...(item.actors||[])]}); const [ne,setNe]=useState(""); const [na,setNa]=useState(""); const [nc,setNc]=useState("");
  const _dRef2=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; _dRef2.current=next; return next; });
  useEffect(()=>{ _dRef2.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(_dRef2.current); },[d]);
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ТИП КОНТЕНТА"><input value={d.type} onChange={e=>u("type",e.target.value)} style={SI}/></Field>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="ДАТА СЪЁМКИ"><input type="datetime-local" value={d.shoot_date} onChange={e=>u("shoot_date",e.target.value)} style={SI}/></Field>
    </div>
    <StatusRow statuses={PROD_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <Field label="ЛОКАЦИЯ"><input value={d.location} onChange={e=>u("location",e.target.value)} placeholder="Адрес / место" style={SI}/></Field>
    <Field label="ОБОРУДОВАНИЕ">
      {d.equipment.map((eq,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:6,padding:"4px 8px",marginBottom:3}}>
        <span>🎥</span><span style={{flex:1,fontSize:11,color:"#d1d5db"}}>{eq}</span>
        <button onClick={()=>u("equipment",d.equipment.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}>×</button>
      </div>)}
      <div style={{display:"flex",gap:5}}>
        <input value={ne} onChange={e=>setNe(e.target.value)} placeholder="Добавить..." style={{...SI,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&ne){u("equipment",[...d.equipment,ne]);setNe("");}}}/>
        <button onClick={()=>{if(ne){u("equipment",[...d.equipment,ne]);setNe("");}}} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:7,padding:"0 11px",color:"#a78bfa",cursor:"pointer",fontSize:16}}>+</button>
      </div>
    </Field>
    <Field label="АКТЁРЫ / УЧАСТНИКИ">
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
        {d.actors.map((a,i)=><div key={i} style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#d1d5db",display:"flex",gap:5}}>
          👤 {a}<button onClick={()=>u("actors",d.actors.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",lineHeight:1}}>×</button>
        </div>)}
      </div>
      <div style={{display:"flex",gap:5}}>
        <input value={na} onChange={e=>setNa(e.target.value)} placeholder="Имя..." style={{...SI,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&na){u("actors",[...d.actors,na]);setNa("");}}}/>
        <button onClick={()=>{if(na){u("actors",[...d.actors,na]);setNa("");}}} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:7,padding:"0 11px",color:"#a78bfa",cursor:"pointer",fontSize:16}}>+</button>
      </div>
    </Field>
    <Field label="ЧЕК-ЛИСТ">
      {d.checklist.map(item=><div key={item.id} onClick={()=>u("checklist",d.checklist.map(c=>c.id===item.id?{...c,done:!c.done}:c))} style={{display:"flex",alignItems:"center",gap:7,background:item.done?"#0a1a0a":"#1a1a2e",border:`1px solid ${item.done?"#10b98130":"#2d2d44"}`,borderRadius:7,padding:"5px 9px",cursor:"pointer",marginBottom:3}}>
        <div style={{width:15,height:15,borderRadius:4,border:`2px solid ${item.done?"#10b981":"#3d3d55"}`,background:item.done?"#10b981":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{item.done&&<span style={{color:"#fff",fontSize:9}}>✓</span>}</div>
        <span style={{fontSize:11,flex:1,color:item.done?"#10b981":"#d1d5db",textDecoration:item.done?"line-through":"none"}}>{item.text}</span>
        <button onClick={e=>{e.stopPropagation();u("checklist",d.checklist.filter(c=>c.id!==item.id));}} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:11}}>×</button>
      </div>)}
      <div style={{display:"flex",gap:5}}>
        <input value={nc} onChange={e=>setNc(e.target.value)} placeholder="Новый пункт..." style={{...SI,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&nc){u("checklist",[...d.checklist,{id:genId(),text:nc,done:false}]);setNc("");}}}/>
        <button onClick={()=>{if(nc){u("checklist",[...d.checklist,{id:genId(),text:nc,done:false}]);setNc("");}}} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:7,padding:"0 11px",color:"#a78bfa",cursor:"pointer",fontSize:16}}>+</button>
      </div>
      <div style={{fontSize:9,color:"#6b7280",fontFamily:"monospace",marginTop:3}}>{d.checklist.filter(c=>c.done).length}/{d.checklist.length} выполнено</div>
    </Field>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.customer} onChange={v=>u("customer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.operator} onChange={v=>u("operator",v)} team={team}/></div>
      </div>
    </div>

    
  </div>;
}

function PostReelsForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
  const [d,setD]=useState({...item,sources:item.sources||[]}); const [tr,setTr]=useState(false); const [gb,setGb]=useState(false);
  const [err,setErr]=useState("");
  const fileRef=useRef(null);
  const dRef=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; dRef.current=next; return next; });
  useEffect(()=>{ dRef.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(dRef.current); },[d]);
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

function PostVideoForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
  const [d,setD]=useState({...item,source_links:item.source_links||[]});
  const fileRef=useRef(null);
  const dRefPV=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; dRefPV.current=next; return next; });
  useEffect(()=>{ dRefPV.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(dRefPV.current); },[d]);
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

function PostCarouselForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
  const [d,setD]=useState({...item,slides:[...((item.slides&&item.slides.length?item.slides:[{id:genId(),text:"",img:"",img_name:""}]))]});  const [newSlide,setNewSlide]=useState("");
  const _dRef3=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; _dRef3.current=next; return next; });
  useEffect(()=>{ _dRef3.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(_dRef3.current); },[d]);
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

function PubForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item}); const [aiCap,setAiCap]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef(null);
  const dRefPV=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; dRefPV.current=next; return next; });
  useEffect(()=>{ dRefPV.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(dRefPV.current); },[d]);
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

function AdminForm({item, onSave, onDelete, onClose, projects, team, currentUser, saveFnRef}) {
  const [d, setD] = useState({status:"new", priority:"normal", ...item});
  const u = (k,v) => setD(p => ({...p, [k]:v}));
  useEffect(() => { if(saveFnRef) saveFnRef.current = () => onSave(d); }, [d]);
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:1}}>
        <label style={LB}>НАЗВАНИЕ</label>
        <input value={d.title||""} onChange={e=>u("title",e.target.value)} style={SI} placeholder="Название задачи"/>
      </div>
      <div style={{width:160}}>
        <label style={LB}>ПРОЕКТ</label>
        <select value={d.project||""} onChange={e=>u("project",e.target.value)} style={SI}>
          <option value="">— без проекта —</option>
          {projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
    </div>
    <StatusRow statuses={ADMIN_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:1}}>
        <label style={LB}>ДЕДЛАЙН</label>
        <input type="date" value={d.deadline||""} onChange={e=>u("deadline",e.target.value)} style={SI}/>
      </div>
      <div style={{flex:1}}>
        <label style={LB}>ПРИОРИТЕТ</label>
        <select value={d.priority||"normal"} onChange={e=>u("priority",e.target.value)} style={SI}>
          <option value="low">Низкий</option>
          <option value="normal">Обычный</option>
          <option value="high">Высокий</option>
          <option value="urgent">Срочно</option>
        </select>
      </div>
    </div>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div>
          <TeamSelect label="" value={d.customer||""} onChange={v=>u("customer",v)} team={team}/>
        </div>
        <div>
          <div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div>
          <TeamSelect label="" value={d.executor||""} onChange={v=>u("executor",v)} team={team}/>
        </div>
      </div>
    </div>
    <div>
      <label style={LB}>ТЗ / ОПИСАНИЕ</label>
      <textarea value={d.description||""} onChange={e=>u("description",e.target.value)}
        placeholder="Подробное описание задачи..."
        style={{...SI, minHeight:90, resize:"vertical", lineHeight:1.5}}/>
    </div>
    <SaveRow onClose={onClose} onSave={()=>onSave(d)} onDelete={item?.id ? ()=>onDelete(item.id) : undefined}/>
  </div>;
}

function SingleReelStats({ taskId, reelUrl, index, onUrlSave, reelsCount }) {
  const [url, setUrl] = useState(reelUrl || "");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(!reelUrl);
  const storageKey = index === 0 ? "reel_url" : `reel_url_${index}`;

  useEffect(() => {
    if (taskId && reelUrl) loadHistory();
  }, [taskId, reelUrl]);

  async function loadHistory() {
    setLoading(true);
    try {
      const r = await fetch(`/api/reel-stats/${taskId}`);
      const data = await r.json();
      setHistory(Array.isArray(data) ? data.filter(h => h.reel_url === reelUrl) : []);
    } catch(e) {}
    setLoading(false);
  }

  const [errMsg, setErrMsg] = useState("");

  async function refresh() {
    setRefreshing(true);
    setErrMsg("");
    try {
      const r = await fetch(`/api/reel-stats/refresh/${taskId}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ url_key: storageKey })
      });
      const data = await r.json();
      if (!r.ok) {
        // Если URL не задан — просто показываем подсказку добавить URL, не ошибку
        if (data.error?.includes("reel_url not set")) {
          setEditing(true);
        } else {
          setErrMsg(data.error || "Ошибка обновления");
        }
        setRefreshing(false);
        return;
      }
      await loadHistory();
    } catch(e) { setErrMsg(e.message); }
    setRefreshing(false);
  }

  async function saveUrl() {
    if (!url.trim()) return;
    onUrlSave(url.trim());
    setEditing(false);
    if (taskId) {
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ data: { [storageKey]: url.trim() } }),
        });
      } catch(e) { console.error("reel_url save:", e); }
    }
  }

  const latest = history[history.length - 1];
  const prev   = history[history.length - 2];

  function delta(key) {
    if (!latest || !prev) return null;
    const d = (latest[key]||0) - (prev[key]||0);
    return d > 0 ? `+${d}` : d < 0 ? String(d) : null;
  }
  function fmt(n) {
    if (!n) return "0";
    if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
    if (n >= 1000) return (n/1000).toFixed(1)+"K";
    return String(n);
  }
  function Sparkline({ data, color }) {
    if (data.length < 2) return null;
    const w = 100, h = 28;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    }).join(" ");
    const last = pts.split(" ").pop().split(",");
    return (
      <svg width={w} height={h} style={{overflow:"visible"}}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx={last[0]} cy={last[1]} r="3" fill={color}/>
      </svg>
    );
  }

  const viewHistory = history.map(h => h.views || 0);
  const likeHistory = history.map(h => h.likes || 0);
  const label = reelsCount > 1 ? `📊 РИЛС ${index + 1} из ${reelsCount}` : "📊 СТАТИСТИКА РИЛСА";

  return (
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"12px 14px",marginBottom: reelsCount > 1 ? 8 : 0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontSize:9,color:"#ec4899",fontFamily:"monospace",fontWeight:700}}>{label}</div>
        <div style={{display:"flex",gap:6}}>
          {reelUrl && !editing && (
            <button onClick={refresh} disabled={refreshing}
              style={{background:"transparent",border:"1px solid #ec489940",borderRadius:6,padding:"3px 10px",color:"#ec4899",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
              {refreshing ? "⏳" : "🔄 Обновить"}
            </button>
          )}
          <button onClick={() => setEditing(!editing)}
            style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"3px 10px",color:"#9ca3af",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
            {editing ? "✕" : "✏️ URL"}
          </button>
        </div>
      </div>

      {(editing || !reelUrl) && (
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key==="Enter" && saveUrl()}
            placeholder="https://www.instagram.com/reel/..."
            style={{background:"#16161f",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 10px",color:"#f0eee8",fontSize:11,outline:"none",flex:1,fontFamily:"inherit"}}/>
          <button onClick={saveUrl} disabled={!url.trim()}
            style={{background:"#ec489920",border:"1px solid #ec489950",borderRadius:7,padding:"6px 14px",color:"#ec4899",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700}}>
            Сохранить
          </button>
        </div>
      )}

      {!reelUrl && !editing && (
        <div style={{textAlign:"center",padding:"10px 0",color:"#4b5563",fontSize:11}}>
          Вставьте ссылку на рилс
        </div>
      )}

      {reelUrl && !editing && (
        <>
          {latest ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
              {[
                { key:"views",    icon:"👁",  label:"Просмотры", color:"#06b6d4" },
                { key:"likes",    icon:"❤️", label:"Лайки",     color:"#ec4899" },
                { key:"comments", icon:"💬",  label:"Коммент.",  color:"#8b5cf6" },
              ].map(s => {
                const d = delta(s.key);
                return (
                  <div key={s.key} style={{background:"#111118",border:"1px solid #1a1a2e",borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                    <div style={{fontSize:13,marginBottom:1}}>{s.icon}</div>
                    <div style={{fontSize:14,fontWeight:800,color:s.color,fontFamily:"monospace"}}>{fmt(latest[s.key]||0)}</div>
                    <div style={{fontSize:7,color:"#4b5563",fontFamily:"monospace"}}>{s.label}</div>
                    {d && <div style={{fontSize:8,color:d.startsWith("+")?"#10b981":"#ef4444",fontFamily:"monospace",marginTop:1}}>{d}</div>}
                  </div>
                );
              })}
            </div>
          ) : loading ? (
            <div style={{textAlign:"center",padding:"10px",color:"#4b5563",fontSize:11}}>⏳ Загружаю...</div>
          ) : (
            <div style={{textAlign:"center",padding:"10px",color:"#4b5563",fontSize:11}}>Нет данных — нажмите «🔄 Обновить»</div>
          )}
          {errMsg && <div style={{fontSize:10,color:"#ef4444",fontFamily:"monospace",marginTop:4,textAlign:"center"}}>⚠️ {errMsg}</div>}
          {history.length >= 2 && (
            <div style={{display:"flex",gap:12,padding:"6px 0",borderTop:"1px solid #1a1a2e"}}>
              <div><div style={{fontSize:7,color:"#4b5563",fontFamily:"monospace",marginBottom:2}}>👁 ПРОСМОТРЫ</div><Sparkline data={viewHistory} color="#06b6d4"/></div>
              <div><div style={{fontSize:7,color:"#4b5563",fontFamily:"monospace",marginBottom:2}}>❤️ ЛАЙКИ</div><Sparkline data={likeHistory} color="#ec4899"/></div>
            </div>
          )}
          {latest && (
            <div style={{fontSize:7,color:"#374151",fontFamily:"monospace",textAlign:"right",marginTop:4}}>
              {new Date(latest.recorded_at).toLocaleString("ru",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
              {history.length > 1 && ` · ${history.length} снапшотов`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReelStatsBlock({ taskId, reelUrls, onUrlSave, reelsCount }) {
  const count = Math.max(1, reelsCount || 1);
  const urls = Array.isArray(reelUrls) ? reelUrls : (reelUrls ? [reelUrls] : []);
  return (
    <div>
      {Array.from({length: count}, (_, i) => (
        <SingleReelStats
          key={i}
          taskId={taskId}
          reelUrl={urls[i] || ""}
          index={i}
          reelsCount={count}
          onUrlSave={url => {
            const newUrls = [...urls];
            newUrls[i] = url;
            onUrlSave(newUrls);
          }}
        />
      ))}
    </div>
  );
}


export { FinalFileOrLink, SourceInputs, SlideImageUpload, PreForm, ProdForm, PostReelsForm, PostVideoForm, PostCarouselForm, PubForm, AdminForm, SingleReelStats, ReelStatsBlock };
