import React, { useState, useRef, useEffect } from "react";
import RU_HOLIDAYS from "./holidays";
import { api, createWS } from "./api";
import LoginScreen from "./LoginScreen";

const APP_NAME = "Виноград";

const TABS = [
  { id:"pre",       label:"Препродакшн",  color:"#8b5cf6" },
  { id:"prod",      label:"Продакшн",      color:"#3b82f6" },
  { id:"post",      label:"Постпродакшн",  color:"#ec4899" },
  { id:"pub",       label:"Публикация",    color:"#10b981" },
  { id:"admin",     label:"Адм. задачи",   color:"#f97316" },
  { id:"summary",   label:"Сводка",        color:"#f97316" },
  { id:"analytics", label:"Аналитика",     color:"#a78bfa" },
  { id:"base",      label:"База",          color:"#06b6d4" },
];

const PRE_STATUSES  = [{id:"idea",l:"Идея",c:"#6b7280"},{id:"brief",l:"Бриф",c:"#f59e0b"},{id:"script",l:"Сценарий",c:"#8b5cf6"},{id:"approved",l:"Утверждено",c:"#10b981"}];
const PROD_STATUSES = [{id:"planned",l:"Запланировано",c:"#6b7280"},{id:"ready",l:"Готово к съёмке",c:"#f59e0b"},{id:"shooting",l:"Идёт съёмка",c:"#3b82f6"},{id:"done",l:"Снято",c:"#10b981"}];
const POST_STATUSES = [{id:"not_started",l:"Не начат",c:"#4b5563"},{id:"in_progress",l:"В монтаже",c:"#f59e0b"},{id:"review",l:"На проверке",c:"#8b5cf6"},{id:"done",l:"Готово",c:"#10b981"}];
const PUB_STATUSES  = [{id:"draft",l:"Черновик",c:"#6b7280"},{id:"ready",l:"Готово",c:"#f59e0b"},{id:"scheduled",l:"Запланировано",c:"#3b82f6"},{id:"published",l:"Опубликовано",c:"#10b981"}];
const pubCount = x => (x.pub_type==="carousel" ? 1 : Math.max(1, parseInt(x.reels_count)||1));
const ADMIN_STATUSES = [{id:"new",l:"Новая",c:"#6b7280"},{id:"in_progress",l:"В работе",c:"#f59e0b"},{id:"waiting",l:"Ожидание",c:"#3b82f6"},{id:"done",l:"Выполнено",c:"#10b981"},{id:"cancelled",l:"Отменено",c:"#ef4444"}];
const ROLES_LIST    = ["Директор","Менеджер проекта","Сценарист","Оператор","Монтажёр","Продюсер","Таргетолог","Дизайнер","Другое"];
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WDAYS  = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const AVATAR_COLORS = ["#ef4444","#3b82f6","#ec4899","#10b981","#f59e0b","#8b5cf6","#06b6d4","#f97316"];


// ── XHR upload with progress ──────────────────────────────────────────────────
function xhrUpload(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData(); fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) onProgress(Math.round(ev.loaded/ev.total*100)); };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const up = JSON.parse(xhr.responseText);
        const k = up.key||"";
        resolve(k ? `/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(file.name)}` : up.url);
      } else { reject(new Error("Ошибка " + xhr.status)); }
    };
    xhr.onerror = () => reject(new Error("Ошибка сети"));
    xhr.open("POST", "/api/upload");
    xhr.send(fd);
  });
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
function UploadProgress({progress, fileName}) {
  return <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:8,padding:"10px 12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <span style={{fontSize:11,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}>{fileName}</span>
      <span style={{fontSize:12,color:"#06b6d4",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>{progress}%</span>
    </div>
    <div style={{background:"#1e1e2e",borderRadius:4,height:6,overflow:"hidden"}}>
      <div style={{width:`${progress}%`,height:"100%",background:"linear-gradient(90deg,#06b6d4,#8b5cf6)",borderRadius:4,transition:"width 0.15s"}}/>
    </div>
  </div>;
}


const genId = () => Math.random().toString(36).slice(2,9);
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const fd=(y,m)=>{const d=new Date(y,m,1).getDay();return d===0?6:d-1;};


const SI={background:"#16161f",border:"1px solid #2d2d44",borderRadius:8,padding:"8px 11px",color:"#f0eee8",fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};
const LB={fontSize:9,color:"#cbd5e1",fontWeight:700,letterSpacing:"0.1em",marginBottom:4,display:"block",fontFamily:"monospace"};
const projOf=(id,projects)=>projects.find(p=>p.id===id)||{label:"?",color:"#9ca3af"};
const teamOf=(id,team)=>team.find(u=>u.id===id);
const stColor=(sts,id)=>sts.find(s=>s.id===id)?.c||"#6b7280";

function Badge({color,children}){ return <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:color+"20",color,fontFamily:"monospace"}}>{children}</span>; }
function Field({label,children}){ return <div><span style={LB}>{label}</span>{children}</div>; }
function Btn({onClick,color="#7c3aed",disabled,children,style={}}){
  return <button onClick={onClick} disabled={disabled} style={{background:disabled?"#1a1a2e":`linear-gradient(135deg,${color},${color}cc)`,border:"none",borderRadius:7,padding:"4px 11px",color:disabled?"#4b5563":"#fff",cursor:disabled?"not-allowed":"pointer",fontSize:10,fontFamily:"inherit",fontWeight:600,...style}}>{children}</button>;
}
function TeamSelect({label,value,onChange,team}){
  return <Field label={label}>
    <select value={value||""} onChange={e=>onChange(e.target.value)} style={SI}>
      <option value="">— не назначен —</option>
      {team.map(u=><option key={u.id} value={u.id}>@{u.name} · {u.role}</option>)}
    </select>
  </Field>;
}

// ── MiniChat ──────────────────────────────────────────────────────────────────
function MiniChat({taskId, team, currentUser}){
  const [msgs,     setMsgs]   = useState([]);
  const [text,     setText]   = useState("");
  const [uploading,setUploading] = useState(false); // bool
  const [uploadPct,setUploadPct] = useState(0);     // 0-100
  const [uploadName,setUploadName] = useState("");
  const [err,      setErr]    = useState("");
  const [showM,    setShowM]  = useState(false);
  const [mentionQ, setMentionQ] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSec,    setRecSec]    = useState(0);
  const bottomRef = useRef(null);
  const fileRef   = useRef(null);
  const inputRef  = useRef(null);
  const mediaRecRef  = useRef(null);
  const recChunksRef = useRef([]);
  const recTimerRef  = useRef(null);
  const myId = currentUser?.id || "";
  const nm   = id => { try { return teamOf(id, team)?.name || "?"; } catch(e) { return "?"; } };

  // load history
  useEffect(() => {
    if (!taskId || taskId === "undefined") return;
    fetch(`/api/chat/${taskId}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        if (!Array.isArray(rows)) return;
        setMsgs(rows.map(r => ({
          id:    r.id    || genId(),
          user:  r.user_id || "",
          text:  r.text  || "",
          ts:    r.created_at || Date.now(),
          fname: r.file_name || "",
          furl:  r.file_url  || "",
          isLog: r.file_name === "__log__",
        })));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
      })
      .catch(() => {});
  }, [taskId]);

  // send text
  async function send() {
    const t = text.trim(); if (!t) return;
    if (!taskId || taskId === "undefined") { setErr("Сначала сохраните задачу"); return; }
    setText(""); setShowM(false);
    try {
      const r = await fetch(`/api/chat/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: myId, text: t, file_url: "", file_name: "" }),
      });
      if (!r.ok) throw new Error(await r.text());
      const m = await r.json();
      setMsgs(p => [...p, { id: m.id||genId(), user: m.user_id||myId, text: m.text||t, ts: m.created_at||Date.now(), fname: "", furl: "", isLog: m.file_name==="__log__" }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    } catch(e) { setErr("Ошибка: " + e.message); }
  }

  // upload with REAL progress via XMLHttpRequest
  function handleFiles(e) {
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (!files.length) return;
    if (!taskId || taskId === "undefined") { setErr("Сначала сохраните задачу"); return; }
    setErr("");
    uploadNext(files, 0);
  }

  function uploadNext(files, i) {
    if (i >= files.length) return;
    const f = files[i];
    setUploading(true);
    setUploadPct(0);
    setUploadName(f.name);

    const fd = new FormData();
    fd.append("file", f);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setUploadPct(Math.round((ev.loaded / ev.total) * 90));
      }
    };

    xhr.onload = async () => {
      if (xhr.status !== 200) {
        setErr("Ошибка загрузки: " + xhr.statusText);
        setUploading(false);
        uploadNext(files, i + 1);
        return;
      }
      let upData;
      try { upData = JSON.parse(xhr.responseText); } catch(e) { setErr("Ошибка ответа сервера"); setUploading(false); return; }
      const key = upData.key || "";
      const dlurl = key
        ? `/api/download?key=${encodeURIComponent(key)}&name=${encodeURIComponent(f.name)}`
        : upData.url;
      setUploadPct(95);
      try {
        const msgR = await fetch(`/api/chat/${taskId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: myId, text: "", file_url: dlurl, file_name: f.name }),
        });
        if (!msgR.ok) throw new Error(await msgR.text());
        const m = await msgR.json();
        setUploadPct(100);
        setMsgs(p => [...p, { id: m.id||genId(), user: m.user_id||myId, text: "", ts: m.created_at||Date.now(), fname: f.name, furl: dlurl }]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
      } catch(e) { setErr(e.message); }
      setTimeout(() => { setUploading(false); setUploadPct(0); setUploadName(""); uploadNext(files, i + 1); }, 800);
    };

    xhr.onerror = () => {
      setErr("Сетевая ошибка при загрузке файла");
      setUploading(false);
      uploadNext(files, i + 1);
    };

    xhr.send(fd);
  }

  // ── Voice recording ──────────────────────────────────────────────────────────
  async function startRec() {
    if (recording || !taskId || taskId === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      recChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recTimerRef.current); setRecSec(0);
        const blob = new Blob(recChunksRef.current, { type: mimeType });
        const fname = "voice_" + Date.now() + ".webm";
        setUploading(true); setUploadName("🎙️ Отправляю...");
        try {
          const fd2 = new FormData();
          fd2.append("file", new File([blob], fname, { type: blob.type }));
          const up = await fetch("/api/upload", { method:"POST", body:fd2 });
          if (up.ok) {
            const upD = await up.json();
            const k = upD.key||"";
            const dlurl = k ? `/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(fname)}` : upD.url;
            const msgR = await fetch(`/api/chat/${taskId}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({user_id:myId,text:"",file_url:dlurl,file_name:fname}) });
            if (msgR.ok) {
              const m=await msgR.json();
              setMsgs(p=>[...p,{id:m.id||genId(),user:m.user_id||myId,text:"",ts:m.created_at||Date.now(),fname,furl:dlurl,isVoice:true,voiceBlob:blob}]);
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
            }
          }
        } catch(e2) { setErr("Ошибка записи: " + e2.message); }
        setUploading(false); setUploadName("");
      };
      mr.start();
      mediaRecRef.current = mr; setRecording(true); setRecSec(0);
      recTimerRef.current = setInterval(() => setRecSec(s => s+1), 1000);
    } catch(e) { setErr("Микрофон недоступен: " + e.message); }
  }
  function stopRec() {
    if (mediaRecRef.current && recording) { mediaRecRef.current.stop(); setRecording(false); }
  }
  async function transcribeMsg(msgId, furl, fname) {
    setMsgs(p => p.map(m => m.id===msgId ? {...m, transcribing:true} : m));
    try {
      const rb = await fetch(furl);
      const blob = await rb.blob();
      const fd = new FormData();
      fd.append("file", new File([blob], fname||"voice.webm", { type: blob.type||"audio/webm" }));
      const tr = await fetch("/api/ai/transcribe", { method:"POST", body:fd });
      const trData = await tr.json();
      if (tr.ok && trData.text) {
        setMsgs(p => p.map(m => m.id===msgId ? {...m, transcript:trData.text, transcribing:false} : m));
        // Save transcript to server as reply
        await fetch(`/api/chat/${taskId}`, { method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({user_id:myId, text:"📝 "+trData.text}) });
      } else {
        setMsgs(p => p.map(m => m.id===msgId ? {...m, transcribing:false} : m));
        setErr("Не удалось транскрибировать");
      }
    } catch(e) { setMsgs(p => p.map(m => m.id===msgId ? {...m, transcribing:false} : m)); setErr(e.message); }
  }

  // mentions
  function onType(e) {
    const v = e.target.value; setText(v);
    const at = v.lastIndexOf("@");
    if (at >= 0 && !v.slice(at+1).includes(" ")) { setShowM(true); setMentionQ(v.slice(at+1)); }
    else setShowM(false);
  }
  function pickMention(m) {
    const at = text.lastIndexOf("@");
    setText((at >= 0 ? text.slice(0, at) : "") + "@" + m.name + " ");
    setShowM(false); inputRef.current?.focus();
  }
  const mentionList = (team||[]).filter(m => m.id !== myId && m.name.toLowerCase().includes(mentionQ.toLowerCase())).slice(0,5);

  return (
    <div style={{display:"flex",flexDirection:"column",height:300,background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,position:"relative"}}>
      <div style={{padding:"6px 12px",borderBottom:"1px solid #1e1e2e",fontSize:9,color:"#9ca3af",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>💬 ЧАТ</div>

      {/* messages */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 10px",display:"flex",flexDirection:"column",gap:6,minHeight:0}}>
        {msgs.length===0 && <div style={{textAlign:"center",color:"#6b7280",fontSize:10,paddingTop:20}}>Начните обсуждение</div>}
        {msgs.map(m => {
          // ── Log entry ──
          if (m.isLog) {
            const t = Number(m.ts);
            const timeStr = t > 1000000000 ? new Date(t).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}) : "";
            const actorName = nm(m.user);
            return <div key={m.id} style={{display:"flex",alignItems:"center",gap:6,margin:"4px 0",padding:"0 8px"}}>
              <div style={{flex:1,height:1,background:"#1e1e2e"}}/>
              <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",textAlign:"center",whiteSpace:"nowrap",maxWidth:"80%"}}>
                {timeStr && <span style={{color:"#374151"}}>{timeStr} </span>}
                <span style={{color:"#6b7280"}}>{m.text}</span>
              </div>
              <div style={{flex:1,height:1,background:"#1e1e2e"}}/>
            </div>;
          }
          const isMe = m.user === myId;
          const rawName = nm(m.user);
          const safeName = rawName && rawName.length > 0 ? rawName : "?";
          const ext = (m.fname||"").split(".").pop().toLowerCase();
          const fileIcon = ["jpg","jpeg","png","gif","webp"].includes(ext) ? "🖼️" : ["mp4","mov","avi","mkv","webm"].includes(ext) ? "🎬" : "📎";
          return (
            <div key={m.id} style={{display:"flex",flexDirection:isMe?"row-reverse":"row",gap:5,alignItems:"flex-end",flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"#374151",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>{safeName[0].toUpperCase()}</div>
              <div style={{maxWidth:"80%"}}>
                {!isMe && <div style={{fontSize:8,color:"#9ca3af",fontFamily:"monospace",marginBottom:2}}>@{safeName}</div>}
                <div style={{background:isMe?"#1e1630":"#1a1a2e",border:"1px solid "+(isMe?"#4c1d9530":"#2d2d44"),borderRadius:isMe?"9px 9px 3px 9px":"9px 9px 9px 3px",padding:"6px 10px"}}>
                  {m.text && <div style={{fontSize:11,color:"#f0eee8",lineHeight:1.4,wordBreak:"break-word"}}>{m.text.split(/(@[^\s]+)/g).map((p,i)=>p.startsWith("@")?<span key={i} style={{color:"#a78bfa",fontWeight:700}}>{p}</span>:p)}</div>}
                  {m.furl && (()=>{
                    const isVoiceFile = (m.fname||"").match(/\.webm$|\.ogg$|\.mp3$|\.m4a$/i) || m.isVoice;
                    if (isVoiceFile) return (
                      <div style={{marginTop:m.text?5:0}}>
                        <audio controls src={m.furl} style={{width:"100%",height:32,borderRadius:6,accentColor:"#8b5cf6"}}/>
                        {m.transcript && <div style={{marginTop:5,fontSize:10,color:"#d1d5db",background:"#ffffff0a",borderRadius:5,padding:"5px 8px",lineHeight:1.4}}>📝 {m.transcript}</div>}
                        {!m.transcript && <button onClick={()=>transcribeMsg(m.id,m.furl,m.fname)} disabled={m.transcribing}
                          style={{marginTop:4,background:"transparent",border:"1px solid #4b5563",borderRadius:5,padding:"2px 8px",color:m.transcribing?"#4b5563":"#9ca3af",cursor:m.transcribing?"not-allowed":"pointer",fontSize:9,fontFamily:"monospace"}}>
                          {m.transcribing?"⏳ Транскрибирую...":"📝 Транскрибировать"}
                        </button>}
                      </div>
                    );
                    return (
                      <div style={{display:"flex",alignItems:"center",gap:7,marginTop:m.text?5:0,background:"#ffffff0a",borderRadius:6,padding:"5px 9px"}}>
                        <span style={{fontSize:14}}>{fileIcon}</span>
                        <span style={{fontSize:11,color:"#d1d5db",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.fname||"файл"}</span>
                        <a href={m.furl} target="_blank" rel="noreferrer"
                          style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:5,textDecoration:"none"}}>↓</a>
                      </div>
                    );
                  })()}
                </div>
                <div style={{fontSize:7,color:"#6b7280",marginTop:2,textAlign:isMe?"right":"left"}}>{(()=>{const t=Number(m.ts);return t>1000000000?new Date(t).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}):""})()}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* real upload progress bar */}
      {uploading && (
        <div style={{padding:"6px 10px",borderTop:"1px solid #1e1e2e",flexShrink:0,background:"#0d0d16"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:10,color:"#9ca3af",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📎 {uploadName}</span>
            <span style={{fontSize:10,fontWeight:700,color:uploadPct===100?"#10b981":"#7c3aed",minWidth:36,textAlign:"right"}}>{uploadPct}%</span>
          </div>
          <div style={{height:4,background:"#2d2d44",borderRadius:3,overflow:"hidden"}}>
            <div style={{width:`${uploadPct}%`,height:"100%",background:uploadPct===100?"#10b981":"linear-gradient(90deg,#7c3aed,#a78bfa)",transition:"width 0.2s",borderRadius:3}}/>
          </div>
        </div>
      )}

      {/* error */}
      {err && <div style={{padding:"4px 10px",fontSize:10,color:"#ef4444",background:"#1a0000",borderTop:"1px solid #ef444430",flexShrink:0}}>{err} <button onClick={()=>setErr("")} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:11}}>✕</button></div>}

      {/* mention dropdown */}
      {showM && mentionList.length > 0 && (
        <div style={{position:"absolute",bottom:50,left:8,right:8,background:"#1a1a2e",border:"1px solid #3d3d5c",borderRadius:8,zIndex:200,overflow:"hidden"}}>
          {mentionList.map(m => (
            <div key={m.id} onClick={()=>pickMention(m)}
              style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}
              onMouseEnter={e=>e.currentTarget.style.background="#2d2d44"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#374151",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff"}}>{(m.name||"?")[0]}</div>
              <span style={{color:"#a78bfa",fontSize:11}}>@{m.name}</span>
              <span style={{fontSize:9,color:"#6b7280",marginLeft:"auto"}}>{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* input */}
      <div style={{padding:"6px 8px",borderTop:"1px solid #1e1e2e",display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
        <input ref={fileRef} type="file" multiple accept="*/*" style={{position:"fixed",top:-9999,left:-9999,opacity:0,pointerEvents:"none"}} onChange={handleFiles}/>
        <button onClick={()=>{ if(!uploading&&!recording) fileRef.current?.click(); }} title="Прикрепить файл" disabled={uploading||recording}
          style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 9px",color:(uploading||recording)?"#4b5563":"#9ca3af",cursor:(uploading||recording)?"not-allowed":"pointer",fontSize:14,flexShrink:0}}>📎</button>
        <button onClick={recording?stopRec:startRec} disabled={uploading} title={recording?"Остановить":"Голосовое + транскрипция"}
          style={{background:recording?"#ef4444":"#1a1a2e",border:"1px solid "+(recording?"#ef4444":"#2d2d44"),borderRadius:7,padding:"5px 9px",color:recording?"#fff":"#9ca3af",cursor:uploading?"not-allowed":"pointer",fontSize:recording?10:14,fontWeight:700,flexShrink:0,minWidth:34,transition:"all 0.15s"}}>
          {recording?"⏹ "+recSec+"с":"🎙️"}</button>
        <input ref={inputRef} value={text} onChange={onType}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}if(e.key==="Escape")setShowM(false);}}
          placeholder="Сообщение... (@ для упоминания)"
          style={{...SI,flex:1,fontSize:11,padding:"5px 10px"}}/>
        <button onClick={send} disabled={!text.trim()}
          style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",borderRadius:7,padding:"5px 12px",color:"#fff",cursor:text.trim()?"pointer":"default",fontSize:13,flexShrink:0,opacity:text.trim()?1:0.4}}>➤</button>
      </div>
    </div>
  );
}

// ── Kanban with drag-drop ─────────────────────────────────────────────────────
function Kanban({statuses,items,renderCard,onDrop,onAddClick}){
  const [dragId,setDragId]=useState(null);
  const [overSt,setOverSt]=useState(null);
  return(
    <div style={{display:"flex",gap:10,overflowX:"auto",alignItems:"flex-start",paddingBottom:8}}>
      {statuses.map(st=>{
        const col=items.filter(x=>x.status===st.id);
        return <div key={st.id}
          onDragOver={e=>{e.preventDefault();setOverSt(st.id);}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverSt(null);}}
          onDrop={e=>{e.preventDefault();if(dragId){onDrop(dragId,st.id);setDragId(null);setOverSt(null);}}}
          style={{minWidth:280,width:280,background:overSt===st.id?"#111120":"#0d0d16",border:`1px solid ${overSt===st.id?st.c+"70":"#1e1e2e"}`,borderRadius:12,padding:"10px 8px",flexShrink:0,transition:"all 0.12s"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"0 2px"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:st.c}}/>
            <span style={{fontSize:10,fontWeight:700,color:st.c,fontFamily:"monospace"}}>{st.l}</span>
            <span style={{fontSize:9,background:st.c+"20",color:st.c,borderRadius:10,padding:"0 6px",fontFamily:"monospace"}}>{col.length}</span>
            <button onClick={()=>onAddClick(st.id)} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${st.c}40`,borderRadius:6,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",color:st.c,cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>+</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {col.map(item=>(
              <div key={item.id} draggable onDragStart={()=>setDragId(item.id)} style={{cursor:"grab",userSelect:"none"}}>{renderCard(item)}</div>
            ))}
          </div>
        </div>;
      })}
    </div>
  );
}

// ── Calendar with drag between days ──────────────────────────────────────────
function CalView({items,dateField,onDayClick,renderChip,color,onMoveToDay}){
  const [y,setY]=useState(2026); const [m,setM]=useState(2);
  const [dragId,setDragId]=useState(null);
  const today=new Date(); const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const days=dim(y,m); const first=fd(y,m);
  const byDay={};
  items.forEach(x=>{const df=x[dateField];if(df){const dk=df.slice(0,10);(byDay[dk]=byDay[dk]||[]).push(x);}});
  const dk=d=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const [overDay,setOverDay]=useState(null);
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button onClick={()=>m===0?(setM(11),setY(y=>y-1)):setM(m=>m-1)} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>‹</button>
        <h3 style={{fontSize:15,fontWeight:800,margin:0}}>{MONTHS[m]} <span style={{color:"#9ca3af"}}>{y}</span></h3>
        <button onClick={()=>m===11?(setM(0),setY(y=>y+1)):setM(m=>m+1)} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
        {WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#9ca3af",fontFamily:"monospace",padding:"2px 0",fontWeight:700}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array.from({length:first}).map((_,i)=><div key={"e"+i} style={{minHeight:74}}/>)}
        {Array.from({length:days},(_,i)=>i+1).map(day=>{
          const k=dk(day); const its=byDay[k]||[]; const isToday=k===todayStr; const isOver=overDay===k;
          return <div key={day}
            onDragOver={e=>{e.preventDefault();setOverDay(k);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverDay(null);}}
            onDrop={e=>{e.preventDefault();if(dragId){onMoveToDay(dragId,k);setDragId(null);setOverDay(null);}}}
            onClick={()=>onDayClick(k)}
            style={{minHeight:74,background:isOver?"#111130":isToday?"#0f0f1e":"#111118",border:isOver?`1px solid ${color}`:isToday?`1px solid ${color}`:"1px solid #1e1e2e",borderRadius:6,padding:"4px 4px 3px",cursor:"pointer",transition:"all 0.1s"}}
            onMouseEnter={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor=color+"50";}}
            onMouseLeave={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#1e1e2e";}}>
            <div style={{fontSize:9,color:isToday||isOver?color:"#9ca3af",fontWeight:isToday?800:400,marginBottom:2,fontFamily:"monospace"}}>{day}</div>
            {its.slice(0,2).map(x=>(
              <div key={x.id} draggable onDragStart={e=>{e.stopPropagation();setDragId(x.id);}} style={{cursor:"grab",userSelect:"none"}}>
                {renderChip(x)}
              </div>
            ))}
            {its.length>2&&<div style={{fontSize:8,color:"#9ca3af"}}>+{its.length-2}</div>}
          </div>;
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({items,onItemClick,onDayClick,projects,onMoveToDay,onToggleStar}){
  const [base,setBase]=useState(()=>{const d=new Date(2026,2,2);const dow=d.getDay();d.setDate(d.getDate()-(dow===0?6:dow-1));return d;});
  const [dragId,setDragId]=useState(null); const [overDay,setOverDay]=useState(null);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(d.getDate()+i);return d;});
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const byDay={};items.forEach(x=>{if(x.planned_date){const k=x.planned_date.slice(0,10);(byDay[k]=byDay[k]||[]).push(x);}});
  const todayStr=fmt(new Date());
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={()=>{const d=new Date(base);d.setDate(d.getDate()-7);setBase(d);}} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>‹</button>
        <span style={{fontSize:13,fontWeight:700}}>{days[0].getDate()} {MONTHS[days[0].getMonth()]} — {days[6].getDate()} {MONTHS[days[6].getMonth()]} {days[0].getFullYear()}</span>
        <button onClick={()=>{const d=new Date(base);d.setDate(d.getDate()+7);setBase(d);}} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:2,overflow:"hidden",width:"100%"}}>
        {days.map(d=>{
          const k=fmt(d); const its=byDay[k]||[]; const isToday=k===todayStr; const isOver=overDay===k;
          return <div key={k}
            onDragOver={e=>{e.preventDefault();setOverDay(k);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverDay(null);}}
            onDrop={e=>{e.preventDefault();if(dragId){onMoveToDay(dragId,k+"T12:00");setDragId(null);setOverDay(null);}}}
            onClick={()=>onDayClick(k+"T12:00")}
            style={{background:isOver?"#111130":isToday?"#0f0f1e":"#111118",border:isOver?"1px solid #7c3aed":isToday?"1px solid #7c3aed":"1px solid #1e1e2e",borderRadius:7,padding:"5px 4px",minHeight:115,cursor:"pointer",transition:"all 0.1s",overflow:"hidden"}}
            onMouseEnter={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#3d3d5c";}}
            onMouseLeave={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#1e1e2e";}}>
            <div style={{textAlign:"center",marginBottom:6}}>
              <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace"}}>{WDAYS[days.indexOf(d)]}</div>
              <div style={{fontSize:15,fontWeight:800,color:isToday?"#a78bfa":"#f0eee8"}}>{d.getDate()}</div>
              {(()=>{const mm=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");const h=RU_HOLIDAYS[`${mm}-${dd}`];return h?<div style={{fontSize:7,color:"#f59e0b",fontFamily:"monospace",marginTop:2,lineHeight:1.3,padding:"1px 3px",background:"#f59e0b10",borderRadius:3}}>{h}</div>:null;})()}
            </div>
            {its.map(x=>{
              const sc=stColor(PUB_STATUSES,x.status);
              const st=PUB_STATUSES.find(s=>s.id===x.status);
              const proj=projects.find(p=>p.id===x.project);
              const bg=sc+"18";
              const border=sc+"50";
              return(
              <div key={x.id} draggable
                onDragStart={e=>{e.stopPropagation();setDragId(x.id);}}
                onDragEnd={()=>setDragId(null)}
                onClick={e=>{e.stopPropagation();if(!dragId)onItemClick(x);}}
                style={{background:bg,border:`1px solid ${border}`,borderRadius:4,padding:"4px 5px",marginBottom:3,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:3,marginBottom:3}}>
                  <div style={{fontSize:8,fontWeight:700,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,lineHeight:1.3}}>{x.title||"Без названия"}</div>
                  <span style={{fontSize:11,color:x.starred?"#f59e0b":"#2d2d44",flexShrink:0,lineHeight:1,cursor:"pointer"}}
                    onClick={e=>{e.stopPropagation();e.preventDefault();if(onToggleStar)onToggleStar(x);else onItemClick({...x,_toggleStar:true});}}>★</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
                  {proj&&<span style={{fontSize:6,color:proj.color,fontFamily:"monospace",background:proj.color+"18",borderRadius:2,padding:"1px 3px",maxWidth:55,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.label}</span>}
                  {st&&<span style={{fontSize:6,color:sc,fontFamily:"monospace",background:sc+"18",borderRadius:2,padding:"1px 3px"}}>{st.l}</span>}
                  <span style={{fontSize:7,color:"#6b7280",marginLeft:"auto"}}>{x.pub_type==="carousel"?"🖼":`🎬${(x.reels_count||1)>1?" ×"+(x.reels_count||1):""}`}</span>
                </div>
              </div>
            );})}
          </div>;
        })}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({title,color,onClose,onSave,onDelete,children}){
  const [confirmDel,setConfirmDel]=useState(false);
  const onCloseRef=useRef(onClose);
  useEffect(()=>{onCloseRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onCloseRef.current();};
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.87)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:16,width:"min(700px,96vw)",maxHeight:"93vh",display:"flex",flexDirection:"column",boxShadow:"0 40px 80px rgba(0,0,0,0.8)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"10px 16px",borderBottom:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{flex:1,fontSize:13,fontWeight:800,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          {onDelete&&!confirmDel&&<button onClick={()=>setConfirmDel(true)} title="Удалить" style={{background:"transparent",border:"1px solid #ef444450",borderRadius:7,padding:"5px 10px",color:"#ef4444",cursor:"pointer",fontSize:12}}>🗑</button>}
          {onDelete&&confirmDel&&<><button onClick={()=>{setConfirmDel(false);onDelete();}} style={{background:"#ef4444",border:"none",borderRadius:7,padding:"5px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Удалить!</button><button onClick={()=>setConfirmDel(false)} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 8px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>✕</button></>}
          {onSave&&<button onClick={onSave} style={{background:`linear-gradient(135deg,${color},${color}bb)`,border:"none",borderRadius:7,padding:"5px 16px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>💾 Сохранить</button>}
          <button onClick={onClose} style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:6,width:26,height:26,cursor:"pointer",color:"#9ca3af",fontSize:14,flexShrink:0}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px",isolation:"isolate"}}>{children}</div>
      </div>
    </div>
  );
}

// ── Reusable form pieces ──────────────────────────────────────────────────────
function SaveRow({onClose,onSave,onDelete,color}){
  const [confirmDel,setConfirmDel]=useState(false);
  return <div style={{display:"flex",gap:8,marginTop:4,paddingTop:8,borderTop:"1px solid #1e1e2e"}}>
    {onDelete&&!confirmDel&&<button onClick={()=>setConfirmDel(true)} title="Удалить задачу" style={{background:"transparent",border:"1px solid #ef444440",borderRadius:8,padding:"8px 12px",color:"#ef4444",cursor:"pointer",fontSize:14}}>🗑</button>}
    {onDelete&&confirmDel&&<><button onClick={onDelete} style={{background:"#ef4444",border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Удалить!</button><button onClick={()=>setConfirmDel(false)} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px 10px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>✕</button></>}
    <button onClick={onClose} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
    <button onClick={onSave} style={{flex:2,background:`linear-gradient(135deg,${color},${color}cc)`,border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Сохранить</button>
  </div>;
}
function StatusRow({statuses,value,onChange}){
  return <Field label="СТАТУС">
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {statuses.map(s=><button key={s.id} onClick={()=>onChange(s.id)} style={{flex:1,minWidth:80,padding:"6px 4px",borderRadius:7,cursor:"pointer",background:value===s.id?s.c+"20":"#111118",border:`1px solid ${value===s.id?s.c:"#2d2d44"}`,color:value===s.id?s.c:"#4b5563",fontSize:9,fontFamily:"monospace"}}>{s.l}</button>)}
    </div>
  </Field>;
}

// ── Tab-level filter bar ──────────────────────────────────────────────────────
function FilterBar({pf,setPf,member,setMember,sortBy,setSortBy,projects,team,showMember=true,showSort=true,addLabel,onAdd,showArchived=false,onArchiveToggle}){
  const activeProjs=projects.filter(p=>!p.archived);
  return(
    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:14,padding:"10px 14px",background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10}}>
      <div style={{flex:1,display:"flex",gap:8,flexWrap:"wrap"}}>
        <div>
          <span style={{...LB,display:"inline",marginRight:6}}>ПРОЕКТ</span>
          <select value={pf} onChange={e=>setPf(e.target.value)} style={{...SI,width:"auto",padding:"4px 8px",fontSize:11,display:"inline-block"}}>
            <option value="all">Все</option>
            {activeProjs.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {showMember&&<div>
          <span style={{...LB,display:"inline",marginRight:6}}>СОТРУДНИК</span>
          <select value={member} onChange={e=>setMember(e.target.value)} style={{...SI,width:"auto",padding:"4px 8px",fontSize:11,display:"inline-block"}}>
            <option value="all">Все</option>
            {team.map(u=><option key={u.id} value={u.id}>@{u.name}</option>)}
          </select>
        </div>}
        {showSort&&<div>
          <span style={{...LB,display:"inline",marginRight:6}}>СОРТИРОВКА</span>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...SI,width:"auto",padding:"4px 8px",fontSize:11,display:"inline-block"}}>
            <option value="default">По умолчанию</option>
            <option value="deadline">По дедлайну</option>
            <option value="project">По проекту</option>
            <option value="status">По статусу</option>
          </select>
        </div>}
      </div>
      {onArchiveToggle&&<button onClick={onArchiveToggle} style={{background:showArchived?"#374151":"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 11px",color:showArchived?"#f0eee8":"#4b5563",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>📦 {showArchived?"Скрыть архив":"Архив"}</button>}
      {onAdd&&<button onClick={onAdd} style={{background:"linear-gradient(135deg,#7c3aed,#ec4899)",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>＋ {addLabel}</button>}
    </div>
  );
}

// ── Forms ─────────────────────────────────────────────────────────────────────
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
      <Field label="ДЕДЛАЙН"><input type="date" value={d.deadline} onChange={e=>u("deadline",e.target.value)} style={SI}/></Field>
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
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>

    
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
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>

    
  </div>;
}

// ── FinalFileOrLink — upload file or paste link ──────────────────────────────
function FinalFileOrLink({d,u,fileRef}){
  const [mode,setMode]=useState(d.final_file_url?"file":d.final_link?"link":"link");
  const _ownRef=useRef(null);
  const fRef=fileRef||_ownRef;
  const [uploading,setUploading]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
      <span style={LB}>ФИНАЛЬНОЕ ВИДЕО</span>
      <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
        <button onClick={()=>setMode("link")} style={{background:mode==="link"?"#374151":"transparent",border:"1px solid #2d2d44",borderRadius:5,padding:"2px 9px",color:mode==="link"?"#f0eee8":"#9ca3af",cursor:"pointer",fontSize:10}}>🔗 Ссылка</button>
        <button onClick={()=>setMode("file")} style={{background:mode==="file"?"#374151":"transparent",border:"1px solid #2d2d44",borderRadius:5,padding:"2px 9px",color:mode==="file"?"#f0eee8":"#9ca3af",cursor:"pointer",fontSize:10}}>📁 Файл</button>
      </div>
    </div>
    {mode==="link"&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
      <input value={d.final_link||""} onChange={e=>u("final_link",e.target.value)} placeholder="https://drive.google.com/..." style={{...SI,flex:1}}/>
      {d.final_link&&<a href={d.final_link} target="_blank" rel="noreferrer" style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"5px 12px",borderRadius:6,textDecoration:"none"}}>↓ Открыть</a>}
    </div>}
    {mode==="file"&&<>
      <input ref={fRef} type="file" accept="video/*,audio/*" style={{display:"none"}} onChange={async e=>{
        const f=e.target.files[0]; if(!f) return;
        setUploading(true); setUploadProgress(0); u("final_file_name",f.name); u("final_file_url","");
        try{
          const url = await xhrUpload(f, p=>setUploadProgress(p));
          u("final_file_url", url);
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
                  ? <a href={d.final_file_url} target="_blank" rel="noreferrer" style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:5,textDecoration:"none"}}>↓ Скачать</a>
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
    </>}
  </div>;
}

// ── SourceInputs — upload files OR paste links ──────────────────────────────
function SourceInputs({d, u}){
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingName, setUploadingName] = useState("");
  const [mode, setMode] = useState(d.source_url||d.source_name ? "file" : d.source_link ? "link" : "file");
  const [nl, setNl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef(null);
  const sources = d.sources || (d.source_name ? [{name:d.source_name, url:d.source_url||""}] : []);

  async function addFile(e) {
    const files = Array.from(e.target.files); e.target.value = "";
    if (!files.length) return;
    setUploadErr("");
    for (const f of files) {
      try {
        setUploading(true); setUploadProgress(0); setUploadingName(f.name);
        const dlurl = await xhrUpload(f, p=>setUploadProgress(p));
        const newSources = [...sources, {name:f.name, url:dlurl}];
        u("sources", newSources);
        if (newSources.length === 1) { u("source_name", f.name); u("source_url", dlurl); }
      } catch(e) { setUploadErr(e.message); }
      setUploading(false);
    }
    setUploading(false);
  }

  function addLink() {
    if (!nl.trim()) return;
    const newSources = [...sources, {name:nl, url:nl}];
    u("sources", newSources);
    if (newSources.length === 1) { u("source_link", nl); }
    setNl("");
  }

  function removeSource(i) {
    const newSources = sources.filter((_,j)=>j!==i);
    u("sources", newSources);
    if (newSources.length === 0) { u("source_name",""); u("source_url",""); u("source_link",""); }
    else { u("source_name", newSources[0].name); u("source_url", newSources[0].url||""); }
  }

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
      <span style={LB}>ИСХОДНИК (ВИДЕО)</span>
      <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
        <button onClick={()=>setMode("file")} style={{background:mode==="file"?"#374151":"transparent",border:"1px solid #2d2d44",borderRadius:5,padding:"2px 9px",color:mode==="file"?"#f0eee8":"#9ca3af",cursor:"pointer",fontSize:10}}>📁 Файл</button>
        <button onClick={()=>setMode("link")} style={{background:mode==="link"?"#374151":"transparent",border:"1px solid #2d2d44",borderRadius:5,padding:"2px 9px",color:mode==="link"?"#f0eee8":"#9ca3af",cursor:"pointer",fontSize:10}}>🔗 Ссылка</button>
      </div>
    </div>
    {/* Existing sources */}
    {sources.map((s,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"#0a1a0a",border:"1px solid #10b98130",borderRadius:7,padding:"6px 10px",marginBottom:5}}>
        <span>{s.url&&!s.url.startsWith("http")?"📁":"🔗"}</span>
        <span style={{flex:1,fontSize:11,color:"#10b981",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
        {s.url&&<a href={s.url} target="_blank" rel="noreferrer" style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,textDecoration:"none"}}>↓</a>}
        <button onClick={()=>removeSource(i)} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14}}>×</button>
      </div>
    ))}
    {/* Add new */}
    {mode==="file"&&<>
      <input ref={fileRef} type="file" accept="video/*,audio/*" multiple style={{display:"none"}} onChange={addFile}/>
      <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{width:"100%",background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"10px",color:uploading?"#f59e0b":"#9ca3af",cursor:"pointer",fontSize:12}}>{uploading?"⏳ Загрузка...":"📤 "+ (sources.length?"+ Ещё файл":"Загрузить исходник")}</button>
      {uploadErr&&<div style={{fontSize:10,color:"#ef4444",marginTop:4}}>{uploadErr}</div>}
    </>}
    {mode==="link"&&<div style={{display:"flex",gap:6,marginTop:4}}>
      <input value={nl} onChange={e=>setNl(e.target.value)} placeholder="https://drive.google.com/..." onKeyDown={e=>e.key==="Enter"&&addLink()} style={{...SI,flex:1,fontSize:11}}/>
      <button onClick={addLink} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:7,padding:"0 14px",color:"#a78bfa",cursor:"pointer",fontSize:16}}>+</button>
    </div>}
  </div>;
}

function PostReelsForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
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
    <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={SI}/></Field>
    </div>
    <SourceInputs d={d} u={u}/>
    
    <Field label="ТЗ ДЛЯ МОНТАЖЁРА"><textarea value={d.tz} onChange={e=>u("tz",e.target.value)} placeholder="Описание задачи..." style={{...SI,minHeight:55,resize:"vertical"}}/></Field>
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={LB}>ТРАНСКРИПЦИЯ (Whisper AI)</span>
        <Btn onClick={transcribe} disabled={tr||(!d.source_name&&!(d.sources&&d.sources.length))} color="#7c3aed">{tr?"⏳ Транскрибирую...":"🎙️ Транскрибировать"}</Btn>
      </div>
      <textarea value={d.transcript} onChange={e=>u("transcript",e.target.value)} placeholder="Загрузите исходник и нажмите кнопку..." style={{...SI,minHeight:70,resize:"vertical",lineHeight:1.5}}/>
    </div>
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={LB}>ИДЕИ ДЛЯ БИРОЛОВ (GPT-4)</span>
        <Btn onClick={genBirolls} disabled={gb||!d.transcript} color="#10b981">{gb?"⏳ Генерирую...":"✨ Сгенерировать"}</Btn>
      </div>
      <textarea value={d.birolls} onChange={e=>u("birolls",e.target.value)} placeholder="Появятся после транскрипции..." style={{...SI,minHeight:90,resize:"vertical",fontFamily:"monospace",fontSize:11}}/>
    </div>
    <FinalFileOrLink d={d} u={u} fileRef={fileRef}/>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.editor} onChange={v=>u("editor",v)} team={team}/></div>
      </div>
    </div>
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>

    
  </div>;
}

function PostVideoForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item,source_links:item.source_links||[]}); const [nl,setNl]=useState("");
  const fileRef=useRef(null);
  const dRefPV=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; dRefPV.current=next; return next; });
  useEffect(()=>{ dRefPV.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(dRefPV.current); },[d]);
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
    </div>
    <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={SI}/></Field>
    </div>
    <Field label="ИСХОДНИКИ (ССЫЛКИ)">
      {d.source_links.map((l,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:6,padding:"4px 8px",marginBottom:3}}>
        <a href={l} target="_blank" rel="noreferrer" style={{flex:1,fontSize:11,color:"#a78bfa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {l}</a>
        <button onClick={()=>u("source_links",d.source_links.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}>×</button>
      </div>)}
      <div style={{display:"flex",gap:5}}>
        <input value={nl} onChange={e=>setNl(e.target.value)} placeholder="https://..." style={{...SI,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&nl){u("source_links",[...d.source_links,nl]);setNl("");}}}/>
        <button onClick={()=>{if(nl){u("source_links",[...d.source_links,nl]);setNl("");}}} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:7,padding:"0 11px",color:"#a78bfa",cursor:"pointer",fontSize:16}}>+</button>
      </div>
    </Field>
    <Field label="КОЛ-ВО ИТОГОВЫХ ВИДЕО"><input type="number" min="1" value={d.video_count||1} onChange={e=>u("video_count",parseInt(e.target.value)||1)} style={{...SI,width:100}}/></Field>
    <Field label="ТЗ ДЛЯ МОНТАЖЁРА"><textarea value={d.tz} onChange={e=>u("tz",e.target.value)} placeholder="Подробное ТЗ..." style={{...SI,minHeight:100,resize:"vertical",lineHeight:1.5}}/></Field>
    <FinalFileOrLink d={d} u={u} fileRef={fileRef}/>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.editor} onChange={v=>u("editor",v)} team={team}/></div>
      </div>
    </div>
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>

    
  </div>;
}

// ── Slide image uploader ──────────────────────────────────────────────────────
function SlideImageUpload({slide,idx,onUploaded}){
  const [loading,setLoading]=useState(false);
  const ref=useRef(null);
  async function handle(e){
    const f=e.target.files[0]; if(!f) return;
    setLoading(true);
    try{
      const fd=new FormData(); fd.append("file",f);
      const r=await fetch("/api/upload",{method:"POST",body:fd});
      if(r.ok){const upD=await r.json();const k=upD.key||"";onUploaded(k?`/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(f.name)}`:upD.url,f.name);}
    }catch{}
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

function PostCarouselForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item,slides:[...(item.slides||[{id:genId(),text:"",img:"",img_name:""}])]}); const [newSlide,setNewSlide]=useState("");
  const _dRef3=useRef(d);
  const u=(k,v)=>setD(p=>{ const next={...p,[k]:v}; _dRef3.current=next; return next; });
  useEffect(()=>{ _dRef3.current=d; if(saveFnRef) saveFnRef.current=()=>onSave(_dRef3.current); },[d]);
  const fileRef=useRef(null);
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
    </div>
    <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={SI}/></Field>
    <Field label="ТЕКСТ НА ОБЛОЖКЕ (слайд 1)"><input value={d.cover_text} onChange={e=>u("cover_text",e.target.value)} placeholder="Заголовок карусели..." style={SI}/></Field>
    <Field label="СЛАЙДЫ КАРУСЕЛИ">
      <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:6}}>
        {d.slides.map((sl,i)=>(
          <div key={sl.id} style={{display:"flex",gap:6,alignItems:"flex-start",background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:8,padding:"8px 10px"}}>
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
    <Field label="ТЗ ДЛЯ ДИЗАЙНЕРА"><textarea value={d.tz} onChange={e=>u("tz",e.target.value)} placeholder="Стиль, цвета, шрифты, особенности оформления..." style={{...SI,minHeight:70,resize:"vertical",lineHeight:1.5}}/></Field>
    <Field label="ФИНАЛЬНАЯ ССЫЛКА"><div style={{display:"flex",gap:6,alignItems:"center"}}><input value={d.final_link} onChange={e=>u("final_link",e.target.value)} placeholder="https://..." style={{...SI,flex:1}}/>{d.final_link&&<a href={d.final_link} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#06b6d4",textDecoration:"none",flexShrink:0}}>↓ Открыть</a>}</div></Field>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.designer} onChange={v=>u("designer",v)} team={team}/></div>
      </div>
    </div>
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>

    
  </div>;
}

// ── PubForm ──────────────────────────────────────────────────────────────────
function PubForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item}); const [aiCap,setAiCap]=useState(false);
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
  const reelsCount = d.pub_type==="carousel" ? 1 : Math.max(1, parseInt(d.reels_count)||1);
  const reelUrls = (() => {
    if (Array.isArray(d.reel_urls) && d.reel_urls.length) return d.reel_urls;
    const arr = [];
    for (let i = 0; i < reelsCount; i++) {
      const key = i === 0 ? "reel_url" : `reel_url_${i}`;
      arr.push(d[key] || "");
    }
    return arr;
  })();

  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
      <Field label="НАЗВАНИЕ"><input value={d.title} onChange={e=>u("title",e.target.value)} style={SI}/></Field>
      <Field label="ПРОЕКТ"><select value={d.project} onChange={e=>u("project",e.target.value)} style={SI}>{projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="ТИП ПУБЛИКАЦИИ"><select value={d.pub_type||"video"} onChange={e=>u("pub_type",e.target.value)} style={SI}>
        <option value="video">🎬 Видео / Рилс</option>
        <option value="carousel">🖼 Карусель</option>
      </select></Field>
    </div>
    <StatusRow statuses={PUB_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    {d.pub_type!=="carousel"&&<Field label="КОЛ-ВО РИЛСОВ">
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>u("reels_count",Math.max(1,(d.reels_count||1)-1))} style={{width:28,height:28,background:"#1e1e2e",border:"1px solid #2d2d44",borderRadius:6,color:"#f0eee8",cursor:"pointer",fontSize:14}}>−</button>
        <input type="number" min="1" max="99" value={d.reels_count||1} onChange={e=>u("reels_count",Math.max(1,parseInt(e.target.value)||1))} style={{...SI,width:60,textAlign:"center",fontWeight:700,fontSize:14}}/>
        <button onClick={()=>u("reels_count",Math.min(99,(d.reels_count||1)+1))} style={{width:28,height:28,background:"#1e1e2e",border:"1px solid #2d2d44",borderRadius:6,color:"#f0eee8",cursor:"pointer",fontSize:14}}>+</button>
        {(d.reels_count||1)>1&&<span style={{fontSize:10,color:"#a78bfa",fontFamily:"monospace"}}>× {d.reels_count} рилса в публикации</span>}
      </div>
    </Field>}
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
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){u("file_name",f.name);const fd=new FormData();fd.append("file",f);const r=await fetch("/api/upload",{method:"POST",body:fd}).catch(()=>null);if(r?.ok){const upD=await r.json();const k=upD.key||"";u("file_url",k?`/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(f.name)}`:upD.url);}}}}/>
      {d.file_name
        ?<div style={{background:"#0a1a0a",border:"1px solid #10b98130",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
            <span>📎</span><span style={{fontSize:12,color:"#10b981",flex:1}}>{d.file_name}</span>
            {d.file_url&&<a href={d.file_url} download={d.file_name} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#06b6d4",textDecoration:"none",fontWeight:700}}>↓</a>}
            <button onClick={()=>{u("file_name","");u("file_url","");}} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}>×</button>
          </div>
        :<button onClick={()=>fileRef.current?.click()} style={{width:"100%",background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"10px",color:"#9ca3af",cursor:"pointer",fontSize:12}}>📎 Прикрепить фото / видео</button>}
    </Field>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div><TeamSelect label="" value={d.producer} onChange={v=>u("producer",v)} team={team}/></div>
        <div><div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div><TeamSelect label="" value={d.executor||""} onChange={v=>u("executor",v)} team={team}/></div>
      </div>
    </div>
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>
    {d.pub_type!=="carousel"&&<ReelStatsBlock
      taskId={d.id}
      reelUrls={reelUrls}
      reelsCount={reelsCount}
      onUrlSave={urls => { u("reel_urls", urls); u("reel_url", urls[0]||""); }}
    />}
  </div>;
}


// ── ReelStatsBlock ────────────────────────────────────────────────────────────
function SingleReelStats({ taskId, reelUrl, index, onUrlSave, reelsCount }) {
  const [url, setUrl] = useState(reelUrl || "");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(!reelUrl);
  // Use index-specific storage key
  const storageKey = index === 0 ? "reel_url" : `reel_url_${index}`;

  useEffect(() => {
    if (taskId && reelUrl) loadHistory();
  }, [taskId, reelUrl]);

  async function loadHistory() {
    setLoading(true);
    try {
      const r = await fetch(`/api/reel-stats/${taskId}?idx=${index}`);
      const data = await r.json();
      setHistory(Array.isArray(data) ? data.filter(h => h.reel_url === reelUrl) : []);
    } catch(e) {}
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/reel-stats/refresh/${taskId}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ url_key: storageKey })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка");
      await loadHistory();
    } catch(e) { alert("Ошибка: " + e.message); }
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


