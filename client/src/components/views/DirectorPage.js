import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS, TABS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";

function DirectorPage({currentUser, onBack}) {
  const [tab, setTab] = React.useState("files");
  const [files, setFiles] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [deleting, setDeleting] = React.useState(null);

  React.useEffect(() => {
    if (tab === "files") loadFiles();
    if (tab === "logs") loadLogs();
  }, [tab]);

  async function loadFiles() {
    setLoading(true);
    try { const r = await fetch("/api/director/files"); setFiles(await r.json()); }
    catch(e) { console.error(e); }
    setLoading(false);
  }

  async function loadLogs() {
    setLoading(true);
    try { const r = await fetch("/api/director/logs"); setLogs(await r.json()); }
    catch(e) { console.error(e); }
    setLoading(false);
  }

  async function deleteFile(key, name) {
    if (!window.confirm("Удалить файл " + name + " из хранилища?")) return;
    setDeleting(key);
    try {
      await fetch("/api/director/files", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({key}) });
      setFiles(p => p.filter(f => f.key !== key));
    } catch(e) { alert("Ошибка: " + e.message); }
    setDeleting(null);
  }

  function fmt(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + " KB";
    return (bytes/1048576).toFixed(1) + " MB";
  }

  function fmtDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleString("ru", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  const filtFiles = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const totalSize = files.reduce((s,f) => s + (f.size||0), 0);

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#f0eee8",fontFamily:"Inter,sans-serif"}}>
      {/* Header */}
      <div style={{background:"#111118",borderBottom:"1px solid #1e1e2e",padding:"12px 24px",display:"flex",alignItems:"center",gap:16}}>
        <button onClick={onBack} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 12px",color:"#9ca3af",cursor:"pointer",fontSize:12}}>← Назад</button>
        <div style={{fontSize:16,fontWeight:800,color:"#8b5cf6"}}>🔐 Панель директора</div>
        <div style={{marginLeft:"auto",fontSize:11,color:"#4b5563"}}>👤 {currentUser?.name}</div>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid #1e1e2e",background:"#111118"}}>
        {[["files","📁 Файлы"],["logs","📋 Логи активности"]].map(([id,label]) =>
          <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 24px",background:"transparent",border:"none",borderBottom:tab===id?"2px solid #8b5cf6":"2px solid transparent",color:tab===id?"#8b5cf6":"#6b7280",cursor:"pointer",fontSize:12,fontWeight:tab===id?700:400,fontFamily:"inherit"}}>{label}</button>
        )}
      </div>
      <div style={{padding:24,maxWidth:1200,margin:"0 auto"}}>
        {tab === "files" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по имени..." style={{background:"#16161f",border:"1px solid #2d2d44",borderRadius:8,padding:"7px 12px",color:"#f0eee8",fontSize:12,outline:"none",width:280}}/>
              <div style={{fontSize:11,color:"#4b5563",marginLeft:"auto"}}>
                {files.length} файлов · {fmt(totalSize)}
              </div>
              <button onClick={loadFiles} style={{background:"#1e1e35",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 14px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>🔄 Обновить</button>
            </div>
            {loading ? <div style={{textAlign:"center",color:"#4b5563",padding:40}}>Загрузка...</div> :
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {filtFiles.map(f => {
                const isAudio = /\.(webm|ogg|mp3|m4a|wav)$/i.test(f.name);
                const isVideo = /\.(mp4|mov|avi|mkv)$/i.test(f.name);
                const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
                const icon = isAudio?"🎙️":isVideo?"🎬":isImg?"🖼️":"📎";
                return (
                  <div key={f.key} style={{display:"flex",alignItems:"center",gap:10,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                    <span style={{flex:1,fontSize:11,color:"#d1d5db",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                    <span style={{fontSize:10,color:"#4b5563",flexShrink:0,width:80,textAlign:"right"}}>{fmt(f.size)}</span>
                    <span style={{fontSize:10,color:"#4b5563",flexShrink:0,width:130,textAlign:"right"}}>{fmtDate(f.lastModified)}</span>
                    <a href={`/api/download?key=${encodeURIComponent(f.key)}&name=${encodeURIComponent(f.name)}`} target="_blank" rel="noreferrer"
                      style={{flexShrink:0,background:"#06b6d420",border:"1px solid #06b6d440",borderRadius:5,padding:"3px 10px",color:"#06b6d4",fontSize:10,fontWeight:700,textDecoration:"none"}}>↓</a>
                    <button onClick={()=>deleteFile(f.key,f.name)} disabled={deleting===f.key}
                      style={{flexShrink:0,background:"#ef444415",border:"1px solid #ef444430",borderRadius:5,padding:"3px 8px",color:deleting===f.key?"#4b5563":"#ef4444",cursor:deleting===f.key?"not-allowed":"pointer",fontSize:10}}>
                      {deleting===f.key?"...":"🗑"}
                    </button>
                  </div>
                );
              })}
              {filtFiles.length===0 && <div style={{textAlign:"center",color:"#4b5563",padding:40}}>Файлы не найдены</div>}
            </div>}
          </div>
        )}
        {tab === "logs" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по имени сотрудника..." style={{background:"#16161f",border:"1px solid #2d2d44",borderRadius:8,padding:"7px 12px",color:"#f0eee8",fontSize:12,outline:"none",width:280}}/>
              <button onClick={loadLogs} style={{marginLeft:"auto",background:"#1e1e35",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 14px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>🔄 Обновить</button>
            </div>
            {loading ? <div style={{textAlign:"center",color:"#4b5563",padding:40}}>Загрузка...</div> :
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {logs.filter(l => !search || (l.user_name||"").toLowerCase().includes(search.toLowerCase())).map(l => {
                const isLog = l.file_name === "__log__";
                return (
                  <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"7px 12px",opacity:isLog?0.6:1}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#8b5cf6",flexShrink:0}}>
                      {(l.user_name||"?")[0]?.toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:700,color:"#d1d5db"}}>{l.user_name||"Неизвестный"}</span>
                        <span style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>{l.user_role||""}</span>
                        <span style={{fontSize:9,color:"#374151",marginLeft:"auto",flexShrink:0}}>{fmtDate(l.created_at)}</span>
                      </div>
                      {l.text && <div style={{fontSize:11,color:isLog?"#6b7280":"#9ca3af",marginTop:2,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{isLog?"⚙️ "+l.text:l.text}</div>}
                      {l.file_name && l.file_name!=="__log__" && <div style={{fontSize:10,color:"#06b6d4",marginTop:2}}>📎 {l.file_name}</div>}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default DirectorPage;
