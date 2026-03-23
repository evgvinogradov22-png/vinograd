import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
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

export { FinalFileOrLink, SourceInputs, SlideImageUpload };
