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
  { id:"projects",  label:"Проекты",       color:"#f59e0b" },
  { id:"board",     label:"Доска",         color:"#a78bfa" },
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
    <StatusRow statuses={POST_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="ДЕДЛАЙН"><input type="date" value={d.post_deadline||""} onChange={e=>u("post_deadline",e.target.value)} style={SI}/></Field>
    </div>
    <Field label="ИСХОДНИКИ (ССЫЛКИ)">
      {d.source_links.map((l,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
          <input value={l} onChange={e=>setLink(i,e.target.value)} placeholder="https://..." style={{...SI,flex:1,color:"#a78bfa"}} autoFocus={l===""&&i===d.source_links.length-1}/>
          <button onClick={()=>removeLink(i)} style={{background:"transparent",border:"none",color:"#4b5563",cursor:"pointer",fontSize:18,lineHeight:1,flexShrink:0,padding:"0 2px"}}>×</button>
        </div>
      ))}
      <button onClick={addLink} style={{background:"transparent",border:"1px dashed #2d2d44",borderRadius:7,padding:"7px",color:"#4b5563",cursor:"pointer",fontSize:11,fontFamily:"inherit",width:"100%",textAlign:"center"}}>+ Добавить ссылку</button>
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
    {d.status==="done"&&onSendToPub&&<button onClick={()=>onSendToPub(d)} style={{width:"100%",marginTop:4,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>🚀 Отправить на публикацию</button>}
    
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

function PostCarouselForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef,onSendToPub}){
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
      <input ref={fileRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;u("file_name",f.name);setUploading(true);setUploadProgress(0);const fd=new FormData();fd.append("file",f);const xhr=new XMLHttpRequest();xhr.upload.onprogress=ev=>{if(ev.lengthComputable)setUploadProgress(Math.round(ev.loaded/ev.total*100));};xhr.onload=()=>{setUploading(false);if(xhr.status===200){const upD=JSON.parse(xhr.responseText);const k=upD.key||"";u("file_url",k?`/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(f.name)}`:upD.url);}};xhr.onerror=()=>{setUploading(false);alert("Ошибка загрузки");};xhr.open("POST","/api/upload");xhr.send(fd);}}/>
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
            {d.file_url&&<a href={d.file_url} download={d.file_name} target="_blank" rel="noreferrer" style={{background:"#06b6d420",border:"1px solid #06b6d440",borderRadius:6,padding:"3px 10px",fontSize:11,color:"#06b6d4",textDecoration:"none",fontWeight:700,whiteSpace:"nowrap"}}>⬇ Скачать</a>}
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
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>
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
// ── ReelStatsBlock ────────────────────────────────────────────────────────────
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


// ── AdminForm ────────────────────────────────────────────────────────────────
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
    {item?.id && <MiniChat taskId={item.id} team={team} currentUser={currentUser}/>}
    <SaveRow onClose={onClose} onSave={()=>onSave(d)} onDelete={item?.id ? ()=>onDelete(item.id) : undefined}/>
  </div>;
}

// ── Summary View ──────────────────────────────────────────────────────────────
// ── Unread @mentions ─────────────────────────────────────────────────────────
function UnreadMentions({allChats,projects,team,me,onOpenTask}){
  const myName=(team.find(x=>x.id===me)?.name||"").toLowerCase();
  if(!myName) return null;
  // Find messages that mention me but I haven't replied after
  const [dismissed,setDismissed]=useState([]);
  // Group chats by taskId
  const byTask={};
  allChats.forEach(m=>{ (byTask[m.taskProject]||(byTask[m.taskProject]=[])).push(m); });
  // Find unread mentions: msgs containing @myName, not yet replied by me after them
  const unread=[];
  allChats.forEach((m,idx)=>{
    if(m.user===me) return; // my own message
    if(dismissed.includes(m.id)) return;
    if(!m.text) return;
    if(!m.text.toLowerCase().includes("@"+myName)) return;
    // Check if I replied after this message in same task
    const repliedAfter=allChats.slice(idx+1).some(r=>r.taskProject===m.taskProject&&r.user===me);
    if(!repliedAfter) unread.push(m);
  });
  if(unread.length===0) return (
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,padding:"14px"}}>
      <div style={{fontSize:10,fontWeight:700,color:"#f97316",fontFamily:"monospace",marginBottom:8}}>💬 УПОМИНАНИЯ</div>
      <div style={{textAlign:"center",color:"#9ca3af",fontSize:11,padding:"16px 0"}}>Нет непрочитанных упоминаний</div>
    </div>
  );
  return(
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,padding:"14px"}}>
      <div style={{fontSize:10,fontWeight:700,color:"#f97316",fontFamily:"monospace",marginBottom:10}}>💬 УПОМИНАНИЯ <span style={{fontSize:10,background:"#f97316",color:"#fff",borderRadius:10,padding:"1px 7px",marginLeft:5}}>{unread.length}</span></div>
      <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:300,overflowY:"auto"}}>
        {unread.map((m,i)=>{
          const proj=projOf(m.taskProject,projects);
          const sender=team.find(x=>x.id===m.user);
          return <div key={i} onClick={()=>onOpenTask&&onOpenTask(m.taskType,m.taskItem)} style={{background:"#111118",border:"1px solid #f9741620",borderLeft:"3px solid #f97316",borderRadius:8,padding:"8px 11px",cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background="#16161f"} onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
              <div style={{width:16,height:16,borderRadius:"50%",background:"#374151",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"#fff"}}>{(sender?.name||"?")[0]}</div>
              <span style={{fontSize:10,fontWeight:600,color:"#f0eee8"}}>@{sender?.name||"?"}</span>
              <span style={{fontSize:9,color:"#9ca3af",marginLeft:"auto"}}>{proj.label}</span>
              <button onClick={e=>{e.stopPropagation();setDismissed(p=>[...p,m.id]);}} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:10,padding:"0 2px"}}>✕</button>
            </div>
            <div style={{fontSize:11,color:"#d1d5db",lineHeight:1.4}}>{m.text}</div>
            <div style={{fontSize:8,color:"#8b99a8",marginTop:3}}>в задаче «{m.taskTitle}»</div>
          </div>;
        })}
      </div>
    </div>
  );
}

function SummaryView({preItems,prodItems,postReels,postVideo,postCarousels,pubItems,adminItems=[],projects,team,currentUser,onOpenTask}){
  const ME = currentUser?.id || "";
  const [memberFilter, setMemberFilter] = useState("all");

  const allItems = [...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...pubItems,...(adminItems||[])];

  // Executor fields and customer fields
  function isExecutor(item, uid) {
    // producer = заказчик во всех формах, не исполнитель
    return ["editor","scriptwriter","operator","designer","executor"].some(f => item[f] === uid);
  }
  function isCustomer(item, uid) {
    return item.customer === uid || item.producer === uid;
  }

  // Apply member filter
  function filtered(items) {
    if (memberFilter === "all") return items.filter(x=>!x.archived);
    return items.filter(x=>!x.archived && (isExecutor(x, memberFilter) || isCustomer(x, memberFilter)));
  }

  const myExec = allItems.filter(x => !x.archived && isExecutor(x, ME));
  const myCust = allItems.filter(x => !x.archived && isCustomer(x, ME) && !isExecutor(x, ME));

  // If member filter selected — show their tasks split by role
  const showMember = memberFilter !== "all" ? team.find(t=>t.id===memberFilter) : null;
  const memberExec = showMember ? allItems.filter(x=>!x.archived && isExecutor(x, showMember.id)) : [];
  const memberCust = showMember ? allItems.filter(x=>!x.archived && isCustomer(x, showMember.id) && !isExecutor(x, showMember.id)) : [];

  const execList = showMember ? memberExec : myExec;
  const custList = showMember ? memberCust : myCust;

  const typeLabel = t => {
    if(t.type==="pre") return "Препродакшн";
    if(t.type==="prod") return "Продакшн";
    if(t.type==="post_reels") return "Рилс";
    if(t.type==="post_video") return "Видео";
    if(t.type==="post_carousel") return "Карусель";
    if(t.type==="pub") return "Публикация";
    return t.type||"";
  };
  const statusColor = t => {
    const allS = [...PRE_STATUSES,...PROD_STATUSES,...POST_STATUSES,...PUB_STATUSES];
    return allS.find(s=>s.id===t.status)?.c || "#6b7280";
  };
  const statusLabel = t => {
    const allS = [...PRE_STATUSES,...PROD_STATUSES,...POST_STATUSES,...PUB_STATUSES];
    return allS.find(s=>s.id===t.status)?.l || t.status||"";
  };
  const typeOf = t => {
    if(preItems.includes(t)) return "pre";
    if(prodItems.includes(t)) return "prod";
    if(postReels.includes(t)) return "post_reels";
    if(postVideo.includes(t)) return "post_video";
    if(postCarousels.includes(t)) return "post_carousel";
    if(pubItems.includes(t)) return "pub";
    return t.type||"pre";
  };
  const dateOf = t => t.deadline||t.shoot_date?.slice(0,10)||t.planned_date?.slice(0,10)||t.post_deadline||"";

  function TaskCard({item}) {
    const proj = projOf(item.project, projects);
    const sc = statusColor(item);
    const sl = statusLabel(item);
    const tl = typeLabel(item);
    const date = dateOf(item);
    const execId = item.executor||item.editor||item.scriptwriter||item.operator||item.designer||"";
    const custId = item.customer||item.producer||"";
    const exec = execId ? team.find(t=>t.id===execId) : null;
    const cust = custId ? team.find(t=>t.id===custId) : null;
    return (
      <div onClick={()=>onOpenTask&&onOpenTask(typeOf(item),item)}
        style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"9px 11px",marginBottom:6,cursor:"pointer"}}
        onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
        onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:5,color:"#f0eee8"}}>{item.title||"Без названия"}</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
          <span style={{fontSize:9,padding:"1px 7px",borderRadius:10,fontFamily:"monospace",background:"#1a1a2e",color:"#6b7280",border:"1px solid #2d2d44"}}>{tl}</span>
          <span style={{fontSize:9,padding:"1px 7px",borderRadius:10,fontFamily:"monospace",background:"#1a1a2e",color:"#6b7280",border:"1px solid #2d2d44"}}>{proj.label}</span>
          <span style={{fontSize:9,padding:"1px 7px",borderRadius:10,fontFamily:"monospace",background:sc+"20",color:sc,border:`1px solid ${sc}40`}}>{sl}</span>
        </div>
        <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",display:"flex",gap:10,flexWrap:"wrap"}}>
          {cust&&<span>заказчик: {cust.name}</span>}
          {exec&&exec.id!==cust?.id&&<span>исполнитель: {exec.name}</span>}
          {date&&<span>📅 {date}</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Фильтр по сотруднику */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#6b7280",fontFamily:"monospace",fontWeight:700}}>СОТРУДНИК</span>
        <button onClick={()=>setMemberFilter("all")}
          style={{padding:"5px 12px",borderRadius:7,cursor:"pointer",background:memberFilter==="all"?"#1a1a2e":"transparent",border:`1px solid ${memberFilter==="all"?"#4b5563":"#2d2d44"}`,color:memberFilter==="all"?"#f0eee8":"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:memberFilter==="all"?700:400}}>
          Все
        </button>
        {team.map(m=>(
          <button key={m.id} onClick={()=>setMemberFilter(m.id)}
            style={{padding:"5px 12px",borderRadius:7,cursor:"pointer",background:memberFilter===m.id?"#1a1a2e":"transparent",border:`1px solid ${memberFilter===m.id?"#4b5563":"#2d2d44"}`,color:memberFilter===m.id?"#f0eee8":"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:memberFilter===m.id?700:400}}>
            {m.name}
          </button>
        ))}
      </div>

      {/* Две колонки */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <div style={{fontSize:10,fontWeight:800,fontFamily:"monospace",color:"#9ca3af",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #1e1e2e"}}>
            ИСПОЛНИТЕЛЬ — {execList.length} задач{execList.length===1?"а":execList.length<5?"и":""}
          </div>
          {execList.length===0&&<div style={{fontSize:11,color:"#4b5563",textAlign:"center",padding:"20px 0"}}>Нет задач</div>}
          {execList.map(item=><TaskCard key={item.id} item={item}/>)}
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:800,fontFamily:"monospace",color:"#9ca3af",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #1e1e2e"}}>
            ЗАКАЗЧИК — {custList.length} задач{custList.length===1?"а":custList.length<5?"и":""}
          </div>
          {custList.length===0&&<div style={{fontSize:11,color:"#4b5563",textAlign:"center",padding:"20px 0"}}>Нет задач</div>}
          {custList.map(item=><TaskCard key={item.id} item={item}/>)}
        </div>
      </div>
    </div>
  );
}

// ── Analytics View ────────────────────────────────────────────────────────────
function AnalyticsView({pubItems,projects,kpisData={}}){
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [kpis, setKpis] = useState(kpisData);
  const [kpiLoaded, setKpiLoaded] = useState(false);

  // Load KPIs from server once
  useEffect(()=>{
    fetch("/api/analytics/kpi").then(r=>r.ok?r.json():[]).then(rows=>{
      const map={...kpisData};
      rows.forEach(r=>{ map[`${r.project_id}_${r.year}_${r.month}`]=String(r.kpi); });
      setKpis(map); setKpiLoaded(true);
    }).catch(()=>setKpiLoaded(true));
  },[]);

  function kpiKey(projId) { return `${projId}_${selYear}_${selMonth}`; }
  function getKpi(projId) { return kpis[kpiKey(projId)]||""; }
  function setKpi(projId, val) {
    const key = kpiKey(projId);
    setKpis(p=>({...p,[key]:val}));
    // Debounced save
    clearTimeout(window._kpiTimer);
    window._kpiTimer = setTimeout(()=>{
      fetch("/api/analytics/kpi",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({project_id:projId,month:selMonth,year:selYear,kpi:parseInt(val)||0})
      }).catch(()=>{});
    }, 800);
  }

  // Build list of months (last 12)
  const months = [];
  for(let i=0;i<12;i++){
    let m = now.getMonth()-i; let y=now.getFullYear();
    if(m<0){m+=12;y--;}
    months.push({m,y,label:["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][m]+" "+y});
  }

  // Filter published items (including archived) for selected month
  const published = pubItems.filter(x=>{
    if(x.status!=="published") return false;
    const d = x.planned_date||x.updated_at||"";
    if(!d) return false;
    const dt = new Date(d);
    return dt.getMonth()===selMonth && dt.getFullYear()===selYear;
  });

  const activeProjs = projects.filter(p=>!p.archived);

  // Count by project and type
  function count(projId, type) {
    return published.filter(x=>x.project===projId && (type==="video"?(x.pub_type!=="carousel"):(x.pub_type==="carousel"))).reduce((s,x)=>s+pubCount(x),0);
  }
  function total(projId) { return published.filter(x=>x.project===projId).reduce((s,x)=>s+pubCount(x),0); }

  const totalVideo = published.filter(x=>x.pub_type!=="carousel").reduce((s,x)=>s+pubCount(x),0);
  const totalCarousel = published.filter(x=>x.pub_type==="carousel").reduce((s,x)=>s+pubCount(x),0);
  const totalAll = published.reduce((s,x)=>s+pubCount(x),0);
  const totalKpi = projects.filter(p=>!p.archived).reduce((a,p)=>a+(parseInt(getKpi(p.id))||0),0);

  const pctColor = p => p>=100?"#10b981":p>=60?"#f59e0b":"#ef4444";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Фильтр месяца */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#6b7280",fontFamily:"monospace",fontWeight:700}}>ПЕРИОД</span>
        <select value={`${selYear}-${selMonth}`} onChange={e=>{const[y,m]=e.target.value.split("-");setSelYear(Number(y));setSelMonth(Number(m));}}
          style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"5px 10px",borderRadius:7,fontSize:12,fontFamily:"inherit"}}>
          {months.map(({m,y,label})=><option key={`${y}-${m}`} value={`${y}-${m}`}>{label}</option>)}
        </select>
        <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{totalAll} публикаций за период</span>
      </div>

      {/* Таблица */}
      <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,overflow:"hidden"}}>
        <div style={{fontSize:10,fontWeight:800,color:"#6b7280",fontFamily:"monospace",padding:"12px 16px",borderBottom:"1px solid #1e1e2e",letterSpacing:"1px"}}>
          ПУБЛИКАЦИИ ПО ПРОЕКТАМ
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#0a0a0f"}}>
              <th style={{padding:"8px 16px",textAlign:"left",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>ПРОЕКТ</th>
              <th style={{padding:"8px 16px",textAlign:"center",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>🎬 ВИДЕО / РИЛС</th>
              <th style={{padding:"8px 16px",textAlign:"center",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>🖼 КАРУСЕЛЬ</th>
              <th style={{padding:"8px 16px",textAlign:"center",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>ВСЕГО</th>
              <th style={{padding:"8px 16px",textAlign:"left",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>KPI ПЛАН</th>
              <th style={{padding:"8px 16px",textAlign:"left",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>ВЫПОЛНЕНИЕ</th>
            </tr>
          </thead>
          <tbody>
            {activeProjs.map(proj=>{
              const v = count(proj.id,"video");
              const c = count(proj.id,"carousel");
              const tot = total(proj.id);
              const kpi = parseInt(getKpi(proj.id))||0;
              const pct = kpi>0?Math.min(100,Math.round(tot/kpi*100)):0;
              const pc = pctColor(pct);
              return (
                <tr key={proj.id} style={{borderBottom:"1px solid #0d0d16"}}
                  onMouseEnter={e=>{Array.from(e.currentTarget.cells).forEach(c=>c.style.background="#111118");}}
                  onMouseLeave={e=>{Array.from(e.currentTarget.cells).forEach(c=>c.style.background="");}}>
                  <td style={{padding:"10px 16px",color:"#d1d5db"}}>{proj.label}</td>
                  <td style={{padding:"10px 16px",textAlign:"center"}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:v>0?"#f0eee8":"#2d2d44"}}>{v}</span>
                  </td>
                  <td style={{padding:"10px 16px",textAlign:"center"}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:c>0?"#f0eee8":"#2d2d44"}}>{c}</span>
                  </td>
                  <td style={{padding:"10px 16px",textAlign:"center"}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:tot>0?"#f0eee8":"#2d2d44"}}>{tot}</span>
                  </td>
                  <td style={{padding:"10px 16px"}}>
                    <input type="number" min="0" value={getKpi(proj.id)} onChange={e=>setKpi(proj.id, e.target.value)}
                      placeholder="—"
                      style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"4px 8px",borderRadius:5,fontSize:12,width:60,textAlign:"center",fontFamily:"monospace",outline:"none"}}/>
                  </td>
                  <td style={{padding:"10px 16px"}}>
                    {kpi>0?(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:5,background:"#1a1a2e",borderRadius:3,overflow:"hidden",minWidth:60}}>
                          <div style={{width:pct+"%",height:"100%",background:pc,borderRadius:3,transition:"width 0.3s"}}/>
                        </div>
                        <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:pc,minWidth:34,textAlign:"right"}}>{pct}%</span>
                      </div>
                    ):<span style={{fontSize:10,color:"#2d2d44",fontFamily:"monospace"}}>—</span>}
                  </td>
                </tr>
              );
            })}
            {/* Итого */}
            <tr style={{background:"#0a0a0f",borderTop:"1px solid #2d2d44"}}>
              <td style={{padding:"10px 16px",fontWeight:700,color:"#f0eee8",fontSize:11,fontFamily:"monospace"}}>ИТОГО</td>
              <td style={{padding:"10px 16px",textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:totalVideo>0?"#f0eee8":"#2d2d44"}}>{totalVideo}</span>
              </td>
              <td style={{padding:"10px 16px",textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:totalCarousel>0?"#f0eee8":"#2d2d44"}}>{totalCarousel}</span>
              </td>
              <td style={{padding:"10px 16px",textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:totalAll>0?"#10b981":"#2d2d44"}}>{totalAll}</span>
              </td>
              <td style={{padding:"10px 16px"}}>
                <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{totalKpi>0?"план: "+totalKpi:""}</span>
              </td>
              <td style={{padding:"10px 16px"}}>
                {totalKpi>0&&<span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:pctColor(Math.round(totalAll/totalKpi*100))}}>
                  {Math.min(100,Math.round(totalAll/totalKpi*100))}%
                </span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Залётные рилсы */}
      <StarredReelsView pubItems={pubItems} projects={projects}/>
    </div>
  );
}

function StarredReelsView({pubItems, projects}){
  const now = new Date();
  const [projFilter, setProjFilter] = useState("all");
  const [selMonth, setSelMonth] = useState(-1); // -1 = all time

  const months = [];
  for(let i=0;i<12;i++){
    let m = now.getMonth()-i; let y=now.getFullYear();
    if(m<0){m+=12;y--;}
    months.push({m,y,label:["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][m]+" "+y,key:`${y}-${m}`});
  }

  const starred = pubItems.filter(x=>{
    if(!x.starred) return false;
    if(projFilter!=="all" && x.project!==projFilter) return false;
    if(selMonth!==-1){
      const mk = months.find(m=>m.key===String(selMonth));
      if(mk){
        const d = new Date(x.planned_date||x.updated_at||"");
        if(d.getMonth()!==mk.m || d.getFullYear()!==mk.y) return false;
      }
    }
    return true;
  });

  const activeProjs = projects.filter(p=>!p.archived);

  return(
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:10,fontWeight:800,color:"#6b7280",fontFamily:"monospace",letterSpacing:"1px"}}>★ ЗАЛЁТНЫЕ РИЛСЫ</span>
        <span style={{fontSize:10,color:"#f59e0b",fontFamily:"monospace",fontWeight:700}}>{starred.length} шт.</span>
        <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <select value={projFilter} onChange={e=>setProjFilter(e.target.value)}
            style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"4px 8px",borderRadius:6,fontSize:11,fontFamily:"inherit"}}>
            <option value="all">Все проекты</option>
            {activeProjs.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
            style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"4px 8px",borderRadius:6,fontSize:11,fontFamily:"inherit"}}>
            <option value={-1}>Всё время</option>
            {months.map(({label,key})=><option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>
      {starred.length===0?(
        <div style={{padding:"30px",textAlign:"center",color:"#4b5563",fontSize:11}}>Нет залётных рилсов за выбранный период</div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:1}}>
          {starred.map(item=>{
            const proj = projects.find(p=>p.id===item.project);
            return(
              <div key={item.id} style={{padding:"10px 14px",borderBottom:"1px solid #0d0d16",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{color:"#f59e0b",fontSize:16,flexShrink:0}}>★</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {proj&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"#1a1a2e",color:"#6b7280",border:"1px solid #2d2d44",fontFamily:"monospace"}}>{proj.label}</span>}
                    <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"#1a1a2e",color:"#6b7280",border:"1px solid #2d2d44",fontFamily:"monospace"}}>{item.pub_type==="carousel"?"🖼 Карусель":"🎬 Видео/Рилс"}</span>
                    {item.planned_date&&<span style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>{item.planned_date.slice(0,10)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Base View ─────────────────────────────────────────────────────────────────
function BaseView({projects,setProjects,teamMembers,setTeamMembers,currentUser}){
  const [subTab,setSubTab]=useState("projects");
  const tabs=[
    {id:"projects",label:"📁 Проекты"},
    {id:"team",label:"👥 Команда"},
    {id:"training",label:"📚 Обучение"},
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:6,borderBottom:"1px solid #1e1e2e",paddingBottom:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"7px 16px",borderRadius:"8px 8px 0 0",cursor:"pointer",background:subTab===t.id?"#111118":"transparent",border:subTab===t.id?"1px solid #2d2d44":"1px solid transparent",borderBottom:subTab===t.id?"1px solid #111118":"none",color:subTab===t.id?"#f0eee8":"#6b7280",fontSize:12,fontFamily:"inherit",fontWeight:subTab===t.id?700:400,marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab==="projects"&&<ProjectsView projects={projects} setProjects={setProjects}/>}
      {subTab==="team"&&<TeamView teamMembers={teamMembers} setTeamMembers={setTeamMembers} currentUser={currentUser}/>}
      {subTab==="training"&&<TrainingView/>}
    </div>
  );
}

// ── Training View ─────────────────────────────────────────────────────────────
function TrainingView(){
  const [items,setItems]=useState([]);
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({title:"",url:"",description:"",category:""});
  const u=(k,v)=>setForm(p=>({...p,[k]:v}));
  const categories=["Монтаж","Съёмка","Сценарий","SMM","Дизайн","Другое"];

  useEffect(()=>{
    fetch("/api/training").then(r=>r.ok?r.json():[]).then(setItems).catch(()=>{});
  },[]);

  async function add(){
    if(!form.title.trim()) return;
    try{
      const r=await fetch("/api/training",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(r.ok){const item=await r.json();setItems(p=>[...p,item]);}
      setForm({title:"",url:"",description:"",category:""});setAdding(false);
    }catch(e){alert("Ошибка: "+e.message);}
  }
  async function remove(id){
    await fetch("/api/training/"+id,{method:"DELETE"}).catch(()=>{});
    setItems(p=>p.filter(x=>x.id!==id));
  }

  const grouped={};
  items.forEach(x=>{const c=x.category||"Другое";(grouped[c]=grouped[c]||[]).push(x);});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>setAdding(true)} style={{background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>+ Добавить материал</button>
      </div>

      {adding&&(
        <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:12,fontWeight:700,color:"#06b6d4",marginBottom:2}}>+ Новый материал</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="НАЗВАНИЕ"><input value={form.title} onChange={e=>u("title",e.target.value)} placeholder="Название материала" style={SI}/></Field>
            <Field label="КАТЕГОРИЯ"><select value={form.category} onChange={e=>u("category",e.target.value)} style={SI}>
              <option value="">— выберите —</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select></Field>
          </div>
          <Field label="ССЫЛКА"><input value={form.url} onChange={e=>u("url",e.target.value)} placeholder="https://..." style={SI}/></Field>
          <Field label="ОПИСАНИЕ"><textarea value={form.description} onChange={e=>u("description",e.target.value)} placeholder="Краткое описание..." style={{...SI,minHeight:60,resize:"vertical"}}/></Field>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setAdding(false)} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
            <button onClick={add} style={{flex:2,background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Добавить</button>
          </div>
        </div>
      )}

      {items.length===0&&!adding&&(
        <div style={{textAlign:"center",padding:"50px 0",color:"#4b5563"}}>
          <div style={{fontSize:36,marginBottom:8}}>📚</div>
          <div style={{fontSize:12}}>Добавьте обучающие материалы</div>
        </div>
      )}

      {Object.entries(grouped).map(([cat,catItems])=>(
        <div key={cat}>
          <div style={{fontSize:10,fontWeight:800,color:"#6b7280",fontFamily:"monospace",marginBottom:8,letterSpacing:"0.05em"}}>{cat.toUpperCase()}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {catItems.map(item=>(
              <div key={item.id} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{item.title}</div>
                    {item.description&&<div style={{fontSize:11,color:"#6b7280",lineHeight:1.4}}>{item.description}</div>}
                  </div>
                  <button onClick={()=>remove(item.id)} style={{background:"transparent",border:"none",color:"#2d2d44",cursor:"pointer",fontSize:14,flexShrink:0,padding:0}} onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#2d2d44"}>×</button>
                </div>
                {item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#06b6d4",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {item.url}</a>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


function ProjectCard({proj, showArchive, setProjects}){
  const [nl,setNl]=useState("");
  return <div style={{background:"#111118",border:'1px solid #1e1e2e',borderTop:'3px solid #2d2d44',borderRadius:12,padding:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
<div style={{width:34,height:34,borderRadius:9,background:proj.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{(proj.label||"?")[0]}</div>
            <input value={proj.label} onChange={e=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,label:e.target.value}:x))} onBlur={e=>api.updateProject(proj.id,{label:e.target.value}).catch(()=>{})} style={{...SI,flex:1,padding:"4px 8px",fontSize:13,fontWeight:700}}/>
            <button onClick={async()=>{ const v=!proj.archived; await api.updateProject(proj.id,{archived:v}); setProjects(p=>p.map(x=>x.id===proj.id?{...x,archived:v}:x)); }} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"4px 8px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>{showArchive?"↩":"🗄"}</button>
            <button onClick={async()=>{if(!window.confirm("Удалить проект «"+proj.label+"»? Это действие нельзя отменить.")) return; try{await api.deleteProject(proj.id);setProjects(p=>p.filter(x=>x.id!==proj.id));}catch(e){alert("Ошибка: "+e.message);}}} style={{background:"transparent",border:"1px solid #ef444440",borderRadius:6,padding:"4px 8px",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑</button>
          </div>
          <textarea value={proj.description} onChange={e=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,description:e.target.value}:x))} onBlur={e=>api.updateProject(proj.id,{description:e.target.value}).catch(()=>{})} placeholder="Описание проекта..." style={{...SI,minHeight:60,resize:"vertical",lineHeight:1.5,marginBottom:8,fontSize:11}}/>

          
        </div>;
}

// ── Team View ─────────────────────────────────────────────────────────────────
function TeamView({teamMembers,setTeamMembers,currentUser}){
  const isDirector = currentUser?.role==="Директор";
  const [adding,setAdding]=useState(false);
  const [newM,setNewM]=useState({name:"",role:ROLES_LIST[0],telegram:"",color:"#8b5cf6",note:""});
  async function addMember(){
    if(!newM.name.trim()) return;
    try {
      const created = await api.register({...newM, password: "vinogradov", invite_password: "vinograd2026"});
      setTeamMembers(p=>[...p,{...created, note:""}]);
      setNewM({name:"",role:ROLES_LIST[0],telegram:"",color:"#8b5cf6",note:""});
      setAdding(false);
    } catch(e){ alert("Ошибка добавления: "+e.message); }
  }
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <h2 style={{fontSize:17,fontWeight:800,margin:0,color:"#06b6d4"}}>👥 Команда</h2>
      {isDirector&&<button onClick={()=>setAdding(true)} style={{marginLeft:"auto",background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Добавить сотрудника</button>}
    </div>
    {adding&&<div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:12,padding:"16px",marginBottom:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <Field label="ИМЯ"><input value={newM.name} onChange={e=>setNewM(p=>({...p,name:e.target.value}))} placeholder="Имя Фамилия" style={SI}/></Field>
        <Field label="ДОЛЖНОСТЬ"><select value={newM.role} onChange={e=>setNewM(p=>({...p,role:e.target.value}))} style={SI}>{ROLES_LIST.map(r=><option key={r} value={r}>{r}</option>)}</select></Field>
        <Field label="TELEGRAM"><input value={newM.telegram} onChange={e=>setNewM(p=>({...p,telegram:e.target.value}))} placeholder="@username" style={SI}/></Field>
        <Field label="ЦВЕТ"><div style={{display:"flex",gap:5,marginTop:3}}>{AVATAR_COLORS.map(c=><div key={c} onClick={()=>setNewM(p=>({...p,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:newM.color===c?"3px solid #fff":"3px solid transparent"}}/>)}</div></Field>
      </div>
      <Field label="ЗАМЕТКИ"><textarea value={newM.note} onChange={e=>setNewM(p=>({...p,note:e.target.value}))} placeholder="Специализация, контакты..." style={{...SI,minHeight:55,resize:"vertical"}}/></Field>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={()=>setAdding(false)} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
        <button onClick={addMember} style={{flex:2,background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Добавить</button>
      </div>
    </div>}
    {teamMembers.length===0&&!adding&&<div style={{textAlign:"center",padding:"50px 0",color:"#9ca3af"}}><div style={{fontSize:36,marginBottom:8}}>👥</div><div style={{fontSize:12,color:"#9ca3af"}}>Нет сотрудников</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
      {teamMembers.map(m=><div key={m.id} style={{background:"#111118",border:`1px solid ${m.color}25`,borderTop:`3px solid ${m.color}`,borderRadius:12,padding:"14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
<div style={{width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${m.color},${m.color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff",flexShrink:0}}>{((m.name||"?")[0]).toUpperCase()}</div>
          <div style={{flex:1}}>
            <input value={m.name} onChange={e=>isDirector&&setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,name:e.target.value}:x))} onBlur={e=>isDirector&&api.updateUser(m.id,{name:e.target.value}).catch(()=>{})} readOnly={!isDirector} style={{...SI,padding:"3px 7px",fontSize:13,fontWeight:700,marginBottom:3,opacity:isDirector?1:0.7}}/>
            <select value={m.role} onChange={e=>isDirector&&setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,role:e.target.value}:x))} disabled={!isDirector} style={{...SI,padding:"2px 7px",fontSize:10,opacity:isDirector?1:0.7}}>{ROLES_LIST.map(r=><option key={r} value={r}>{r}</option>)}</select>
          </div>
          {isDirector&&<button onClick={async()=>{ await api.deleteUser(m.id).catch(()=>{}); setTeamMembers(p=>p.filter(x=>x.id!==m.id)); }} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14,alignSelf:"flex-start"}}>×</button>}
        </div>
        <input value={m.telegram} onChange={e=>setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,telegram:e.target.value}:x))} placeholder="@telegram" style={{...SI,marginBottom:6,fontSize:11}}/>
        <textarea value={m.note} onChange={e=>setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,note:e.target.value}:x))} placeholder="Заметки..." style={{...SI,minHeight:50,resize:"vertical",fontSize:11,lineHeight:1.4,marginBottom:8}}/>
        {(()=>{const la=Number(m.last_active);return la>1000000000?<div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",textAlign:"right",marginTop:4}}>🕐 {new Date(la).toLocaleString("ru",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>:<div style={{fontSize:9,color:"#2d2d44",fontFamily:"monospace",textAlign:"right",marginTop:4}}>🕐 не заходил</div>;})()}

      </div>)}
    </div>
  </div>;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("[ErrorBoundary]", e, info); this.setState({info}); }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || "Неизвестная ошибка";
      const stack = this.state.info?.componentStack || "";
      return (
        <div style={{padding:24,color:"#f0eee8",fontFamily:"monospace",background:"#0d0d14",minHeight:"100vh",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:20}}>⚠️</div>
          <div style={{fontSize:14,fontWeight:700,color:"#ef4444"}}>Ошибка приложения</div>
          <div style={{fontSize:11,color:"#9ca3af",background:"#111118",padding:12,borderRadius:8,wordBreak:"break-all"}}>{msg}</div>
          <button onClick={()=>{ localStorage.removeItem("vg_user"); window.location.reload(); }} style={{background:"#ef444420",border:"1px solid #ef444440",borderRadius:8,padding:"10px 16px",color:"#ef4444",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>🔄 Выйти и перезайти</button>
          <button onClick={()=>window.location.reload()} style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:8,padding:"10px 16px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>↩ Перезагрузить</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner(){
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vg_user") || "null"); } catch { return null; }
  });

  function handleLogout() {
    localStorage.removeItem("vg_user");
    setCurrentUser(null);
  }

  if (!currentUser) {
    return <LoginScreen onLogin={u => { localStorage.setItem("vg_user", JSON.stringify(u)); setCurrentUser(u); }}/>;
  }

  return <MainApp currentUser={currentUser} onLogout={handleLogout}/>;
}

export default function App(){
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

// ── Centralized store lookup ──────────────────────────────────────────────────
function useTaskStore(type, stores) {
  const map = {
    pre:           [stores.preItems,      stores.setPreItems],
    prod:          [stores.prodItems,     stores.setProdItems],
    post_reels:    [stores.postReels,     stores.setPostReels],
    post_video:    [stores.postVideo,     stores.setPostVideo],
    post_carousel: [stores.postCarousels, stores.setPostCarousels],
    pub:           [stores.pubItems,      stores.setPubItems],
    admin:         [stores.adminItems,    stores.setAdminItems],
  };
  return map[type] || [[], ()=>{}];
}

// ── IntellectBoard ────────────────────────────────────────────────────────────
function IntellectBoard({ projects, currentUser }) {
  const [stickers, setStickers] = useState([]);
  const [arrows, setArrows]     = useState([]); // [{id,from,to}]
  const [scale, setScale]       = useState(1);
  const [pan, setPan]           = useState({ x: 0, y: 0 });
  const [loading, setLoading]   = useState(true);
  const [mode, setMode]         = useState("select"); // "select" | "arrow"
  const [arrowStart, setArrowStart] = useState(null); // sticker id
  const [dragging, setDragging]     = useState(null);
  const [resizing, setResizing]     = useState(null);
  const [panning, setPanning]       = useState(null); // {startX,startY,origX,origY}
  const [editing, setEditing]       = useState(null);
  const boardRef  = useRef(null);
  const MIN_W = 140, MIN_H = 100;

  // Load
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/stickers").then(r=>r.json()),
      fetch("/api/sticker-arrows").then(r=>r.json()).catch(()=>[]),
    ]).then(([s,a]) => {
      setStickers(Array.isArray(s) ? s : []);
      setArrows(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const projColor = (id) => projects.find(p=>p.id===id)?.color || "#a78bfa";

  // Paper sticker style
  function stickerStyle(s, isDrag) {
    const c = projColor(s.project_id);
    return {
      position:"absolute", left:s.x, top:s.y, width:s.w, height:s.h,
      background: `${c}dd`,
      borderRadius: "2px 12px 10px 2px",
      boxShadow: isDrag
        ? `0 24px 48px rgba(0,0,0,0.6), 2px 2px 0 rgba(0,0,0,0.15), -2px 4px 0 ${c}88`
        : `2px 4px 12px rgba(0,0,0,0.45), 2px 2px 0 rgba(0,0,0,0.12), inset 0 -2px 4px rgba(0,0,0,0.08)`,
      cursor: mode==="arrow" ? "crosshair" : isDrag ? "grabbing" : "grab",
      display:"flex", flexDirection:"column",
      transform: isDrag ? "rotate(2deg) scale(1.04)" : `rotate(${s.rot||0}deg)`,
      transition: isDrag ? "none" : "box-shadow 0.15s, transform 0.15s",
      zIndex: isDrag || editing===s.id ? 200 : 1,
      userSelect:"none",
      // "fold" top-right corner using pseudo via before — done via inner element
    };
  }

  function addSticker() {
    const id = genId();
    const proj = projects.find(p=>!p.archived) || projects[0];
    const rot = (Math.random() - 0.5) * 3; // slight random tilt
    const s = {
      id,
      project_id: proj?.id || "all",
      text: "",
      color: proj?.color || "#a78bfa",
      x: Math.max(20, 80 + Math.random()*300 - pan.x/scale),
      y: Math.max(20, 80 + Math.random()*200 - pan.y/scale),
      w: 200, h: 160,
      rot,
      author_id: currentUser?.id || "",
    };
    setStickers(p => [...p, s]);
    setEditing(id);
    fetch("/api/stickers", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}).catch(()=>{});
  }

  function delSticker(id) {
    setStickers(p=>p.filter(s=>s.id!==id));
    setArrows(p=>p.filter(a=>a.from!==id&&a.to!==id));
    fetch(`/api/stickers/${id}`,{method:"DELETE"}).catch(()=>{});
    fetch(`/api/sticker-arrows/by-sticker/${id}`,{method:"DELETE"}).catch(()=>{});
  }

  function patchSticker(id, patch) {
    setStickers(p=>p.map(s=>s.id===id?{...s,...patch}:s));
    fetch(`/api/stickers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}).catch(()=>{});
  }

  // Arrow mode click on sticker
  function onStickerClick(e, s) {
    if (mode !== "arrow") return;
    e.stopPropagation();
    if (!arrowStart) { setArrowStart(s.id); return; }
    if (arrowStart === s.id) { setArrowStart(null); return; }
    const existing = arrows.find(a=>(a.from===arrowStart&&a.to===s.id)||(a.from===s.id&&a.to===arrowStart));
    if (existing) {
      setArrows(p=>p.filter(a=>a.id!==existing.id));
      fetch(`/api/sticker-arrows/${existing.id}`,{method:"DELETE"}).catch(()=>{});
    } else {
      const id = genId();
      const arrow = {id, from:arrowStart, to:s.id};
      setArrows(p=>[...p,arrow]);
      fetch("/api/sticker-arrows",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(arrow)}).catch(()=>{});
    }
    setArrowStart(null);
  }

  // Drag stickers
  function onMouseDownDrag(e, s) {
    if (mode==="arrow" || e.target.closest(".stk-ctrl") || e.target.closest(".stk-rsz") || e.target.tagName==="TEXTAREA") return;
    e.preventDefault(); e.stopPropagation();
    setDragging({id:s.id, sx:e.clientX, sy:e.clientY, ox:s.x, oy:s.y});
  }
  function onMouseDownResize(e, s) {
    e.preventDefault(); e.stopPropagation();
    setResizing({id:s.id, sx:e.clientX, sy:e.clientY, ow:s.w, oh:s.h});
  }

  // Pan board (middle mouse or background drag in select mode)
  function onBoardMouseDown(e) {
    if (e.target !== boardRef.current && e.target !== boardRef.current?.firstChild) return;
    if (e.button===1 || (e.button===0 && mode==="select")) {
      e.preventDefault();
      setPanning({sx:e.clientX, sy:e.clientY, ox:pan.x, oy:pan.y});
    }
  }

  // Zoom wheel
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(s => Math.min(3, Math.max(0.2, s * delta)));
  }

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, {passive:false});
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    function onMove(e) {
      if (dragging) {
        const dx=(e.clientX-dragging.sx)/scale, dy=(e.clientY-dragging.sy)/scale;
        setStickers(p=>p.map(s=>s.id===dragging.id?{...s,x:Math.max(0,dragging.ox+dx),y:Math.max(0,dragging.oy+dy)}:s));
      }
      if (resizing) {
        const dx=(e.clientX-resizing.sx)/scale, dy=(e.clientY-resizing.sy)/scale;
        setStickers(p=>p.map(s=>s.id===resizing.id?{...s,w:Math.max(MIN_W,resizing.ow+dx),h:Math.max(MIN_H,resizing.oh+dy)}:s));
      }
      if (panning) {
        setPan({x:panning.ox+(e.clientX-panning.sx), y:panning.oy+(e.clientY-panning.sy)});
      }
    }
    function onUp() {
      if (dragging) { const s=stickers.find(x=>x.id===dragging.id); if(s) patchSticker(s.id,{x:s.x,y:s.y}); setDragging(null); }
      if (resizing) { const s=stickers.find(x=>x.id===resizing.id); if(s) patchSticker(s.id,{w:s.w,h:s.h}); setResizing(null); }
      if (panning) setPanning(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return ()=>{ window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); };
  }, [dragging, resizing, panning, stickers, scale]);

  // Compute arrow SVG line between two sticker centers
  function arrowLine(a) {
    const from = stickers.find(s=>s.id===a.from);
    const to   = stickers.find(s=>s.id===a.to);
    if (!from||!to) return null;
    const fx=from.x+from.w/2, fy=from.y+from.h/2;
    const tx=to.x+to.w/2,   ty=to.y+to.h/2;
    // Cubic bezier for curved arrow
    const dx=tx-fx, dy=ty-fy;
    const cx1=fx+dx*0.3-dy*0.15, cy1=fy+dy*0.3+dx*0.15;
    const cx2=fx+dx*0.7+dy*0.15, cy2=fy+dy*0.7-dx*0.15;
    const d=`M${fx},${fy} C${cx1},${cy1} ${cx2},${cy2} ${tx},${ty}`;
    // Arrow head angle
    const angle=Math.atan2(ty-cy2, tx-cx2)*180/Math.PI;
    return {d, tx, ty, angle, id:a.id, color: projColor(from.project_id)};
  }

  const arrowData = arrows.map(arrowLine).filter(Boolean);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 48px)",background:"#07070f",overflow:"hidden"}}>
      {/* Toolbar */}
      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid #1a1a2e",background:"#0d0d16"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#f0eee8",marginRight:4}}>🧠 Интелект-доска</div>

        {/* Mode */}
        <div style={{display:"flex",background:"#111118",borderRadius:8,border:"1px solid #1e1e2e",overflow:"hidden"}}>
          {[["select","☝️ Выбор"],["arrow","↗️ Стрелка"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setArrowStart(null);}}
              style={{padding:"5px 13px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,
                background:mode===m?"#1e1e2e":"transparent",color:mode===m?"#f0eee8":"#4b5563"}}>{l}</button>
          ))}
        </div>

        {arrowStart && <span style={{fontSize:11,color:"#f59e0b",fontFamily:"monospace",animation:"pulse 1s infinite"}}>⬤ Выберите второй стикер...</span>}

        <div style={{flex:1}}/>

        {/* Zoom controls */}
        <div style={{display:"flex",alignItems:"center",gap:6,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"4px 8px"}}>
          <button onClick={()=>setScale(s=>Math.max(0.2,s-0.1))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>−</button>
          <span style={{fontSize:11,color:"#9ca3af",fontFamily:"monospace",minWidth:38,textAlign:"center"}}>{Math.round(scale*100)}%</span>
          <button onClick={()=>setScale(s=>Math.min(3,s+0.1))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>+</button>
          <button onClick={()=>{setScale(1);setPan({x:0,y:0});}} style={{background:"transparent",border:"none",color:"#4b5563",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:"0 2px"}}>1:1</button>
        </div>

        <button onClick={addSticker}
          style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",border:"none",borderRadius:9,padding:"7px 16px",
            fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>+ Стикер</button>
      </div>

      {/* Canvas */}
      <div ref={boardRef}
        onMouseDown={onBoardMouseDown}
        style={{flex:1,position:"relative",overflow:"hidden",
          cursor: panning ? "grabbing" : mode==="arrow" ? "crosshair" : "grab",
          backgroundImage:"radial-gradient(circle, #1e1e2e 1px, transparent 1px)",
          backgroundSize:`${28*scale}px ${28*scale}px`,
          backgroundPosition:`${pan.x}px ${pan.y}px`,
        }}>

        {/* Scaled + panned world */}
        <div style={{position:"absolute",left:pan.x,top:pan.y,
          transform:`scale(${scale})`,transformOrigin:"0 0",
          width:4000,height:4000}}>

          {/* SVG arrows layer */}
          <svg style={{position:"absolute",inset:0,width:4000,height:4000,pointerEvents:"none",overflow:"visible"}}>
            <defs>
              {arrowData.map(a=>(
                <marker key={a.id+"m"} id={`ah-${a.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={a.color} opacity="0.85"/>
                </marker>
              ))}
            </defs>
            {arrowData.map(a=>(
              <g key={a.id}>
                <path d={a.d} fill="none" stroke={a.color} strokeWidth="2.5" opacity="0.7"
                  strokeDasharray="none" markerEnd={`url(#ah-${a.id})`}/>
                {/* Invisible wider path for easier clicking */}
                <path d={a.d} fill="none" stroke="transparent" strokeWidth="12"
                  style={{cursor:"pointer"}}
                  onClick={()=>{setArrows(p=>p.filter(x=>x.id!==a.id));fetch(`/api/sticker-arrows/${a.id}`,{method:"DELETE"}).catch(()=>{});}}/>
              </g>
            ))}
          </svg>

          {/* Stickers */}
          {stickers.map(s => {
            const isDrag = dragging?.id===s.id;
            const isArrowSrc = arrowStart===s.id;
            const p = projects.find(x=>x.id===s.project_id);
            const c = p?.color || "#a78bfa";
            return (
              <div key={s.id}
                onMouseDown={e=>onMouseDownDrag(e,s)}
                onClick={e=>onStickerClick(e,s)}
                style={stickerStyle(s,isDrag)}>

                {/* Paper fold top-right corner */}
                <div style={{position:"absolute",top:0,right:0,width:18,height:18,
                  background:`linear-gradient(225deg, rgba(0,0,0,0.18) 50%, ${c}00 50%)`,
                  borderRadius:"0 12px 0 0",pointerEvents:"none"}}/>

                {/* Arrow-mode highlight */}
                {mode==="arrow"&&<div style={{position:"absolute",inset:0,borderRadius:"2px 12px 10px 2px",
                  border:`2px solid ${isArrowSrc?"#fff":"rgba(255,255,255,0.3)"}`,
                  boxShadow:isArrowSrc?"0 0 12px #fff8":"none",pointerEvents:"none"}}/>}

                {/* Controls */}
                <div className="stk-ctrl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px 3px",flexShrink:0}}>
                  {/* Project dot + label */}
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:"rgba(0,0,0,0.25)",flexShrink:0}}/>
                    <span style={{fontSize:9,color:"rgba(0,0,0,0.45)",fontFamily:"monospace",fontWeight:700,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {p?.label||""}
                    </span>
                  </div>
                  {/* Project change + delete */}
                  <div style={{display:"flex",gap:3,alignItems:"center"}}>
                    <select value={s.project_id}
                      onChange={e=>{e.stopPropagation();patchSticker(s.id,{project_id:e.target.value,color:projects.find(x=>x.id===e.target.value)?.color||"#a78bfa"});}}
                      onClick={e=>e.stopPropagation()}
                      style={{background:"rgba(0,0,0,0.12)",border:"none",borderRadius:4,fontSize:9,color:"rgba(0,0,0,0.5)",cursor:"pointer",fontFamily:"inherit",padding:"1px 2px",maxWidth:60}}>
                      {projects.filter(x=>!x.archived).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <button onClick={e=>{e.stopPropagation();delSticker(s.id);}}
                      style={{background:"rgba(0,0,0,0.12)",border:"none",borderRadius:5,width:17,height:17,cursor:"pointer",
                        fontSize:12,color:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,flexShrink:0}}>×</button>
                  </div>
                </div>

                {/* Text body */}
                <div style={{flex:1,padding:"0 10px 8px",overflow:"hidden"}}>
                  {editing===s.id ? (
                    <textarea autoFocus value={s.text}
                      onMouseDown={e=>e.stopPropagation()}
                      onChange={e=>setStickers(p=>p.map(x=>x.id===s.id?{...x,text:e.target.value}:x))}
                      onBlur={()=>{patchSticker(s.id,{text:s.text});setEditing(null);}}
                      style={{width:"100%",height:"100%",background:"transparent",border:"none",outline:"none",resize:"none",
                        fontSize:13,color:"rgba(0,0,0,0.75)",fontFamily:"inherit",lineHeight:1.55}}/>
                  ) : (
                    <div onClick={e=>{if(mode!=="arrow"){e.stopPropagation();setEditing(s.id);}}}
                      style={{width:"100%",height:"100%",fontSize:13,lineHeight:1.55,whiteSpace:"pre-wrap",wordBreak:"break-word",
                        color:s.text?"rgba(0,0,0,0.75)":"rgba(0,0,0,0.3)",fontStyle:s.text?"normal":"italic",cursor:"text"}}>
                      {s.text||"Нажмите чтобы написать..."}
                    </div>
                  )}
                </div>

                {/* Resize handle */}
                <div className="stk-rsz" onMouseDown={e=>onMouseDownResize(e,s)}
                  style={{position:"absolute",bottom:0,right:0,width:18,height:18,cursor:"nwse-resize",
                    display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:4}}>
                  <svg width="8" height="8"><path d="M0 8L8 0M4 8L8 4" stroke="rgba(0,0,0,0.22)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              </div>
            );
          })}
        </div>

        {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#4b5563"}}>⏳ Загрузка...</div>}
        {!loading&&stickers.length===0&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#2d2d44",pointerEvents:"none"}}>
            <div style={{fontSize:52,marginBottom:12}}>🧠</div>
            <div style={{fontSize:14,fontWeight:700}}>Доска пуста</div>
            <div style={{fontSize:11,marginTop:6}}>Нажмите «+ Стикер» чтобы добавить заметку</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PublishedView ─────────────────────────────────────────────────────────────
function PublishedView({items, projects, onOpen, onToggleStar}) {
  const [stats, setStats] = useState({});
  const [groupBy, setGroupBy] = useState("week"); // "week" | "month"
  const [view, setView] = useState("list"); // "list" | "dashboard"
  const [selectedPeriod, setSelectedPeriod] = useState("all"); // "all" | period key

  useEffect(() => {
    const ids = items.filter(x=>x.status==="published").map(x=>x.id);
    if (!ids.length) return;
    fetch("/api/reel-stats/latest", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({task_ids: ids})
    }).then(r=>r.json()).then(setStats).catch(()=>{});
  }, [items]);

  function fmt(n) {
    if (!n && n !== 0) return null;
    if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
    if (n >= 1000) return (n/1000).toFixed(1)+"K";
    return String(n);
  }
  function fmtFull(n) {
    if (!n) return "—";
    return n.toLocaleString("ru");
  }
  function getWeekKey(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr); if (isNaN(d)) return null;
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d); mon.setDate(diff);
    return mon.toISOString().slice(0, 10);
  }
  function getWeekLabel(monStr) {
    const mon = new Date(monStr);
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const f = d => d.toLocaleDateString("ru", {day:"numeric", month:"short"});
    return `${f(mon)} — ${f(sun)}`;
  }
  function getMonthKey(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr); if (isNaN(d)) return null;
    return d.toISOString().slice(0, 7);
  }
  function getMonthLabel(key) {
    const [y, m] = key.split("-");
    return new Date(+y, +m-1, 1).toLocaleDateString("ru", {month:"long", year:"numeric"});
  }

  const published = items.filter(x => x.status === "published");

  // Group
  const grouped = {};
  published.forEach(item => {
    const dateStr = item.completed_at || item.planned_date?.slice(0,10) || "";
    const k = groupBy === "week" ? (getWeekKey(dateStr)||"unknown") : (getMonthKey(dateStr)||"unknown");
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(item);
  });
  const keys = Object.keys(grouped).filter(k=>k!=="unknown").sort((a,b)=>b.localeCompare(a));
  if (grouped["unknown"]) keys.push("unknown");

  // Per-period totals for dashboard bars
  const periodData = keys.filter(k=>k!=="unknown").map(k => {
    const pItems = grouped[k] || [];
    const views    = pItems.reduce((s,x)=>s+(stats[x.id]?.views||0),0);
    const likes    = pItems.reduce((s,x)=>s+(stats[x.id]?.likes||0),0);
    const comments = pItems.reduce((s,x)=>s+(stats[x.id]?.comments||0),0);
    const label    = groupBy === "week" ? getWeekLabel(k) : getMonthLabel(k);
    const pubsCount = pItems.reduce((s,x)=>s+pubCount(x),0);
    return { k, label, views, likes, comments, count: pubsCount };
  });

  // Items filtered by selected period
  const filteredPeriodData = selectedPeriod === "all" ? periodData : periodData.filter(d=>d.k===selectedPeriod);
  const filteredItems = selectedPeriod === "all" ? published : (grouped[selectedPeriod] || []);

  // Totals for dashboard — computed from filtered period
  const totalViews    = filteredPeriodData.reduce((s,d)=>s+d.views,0);
  const totalLikes    = filteredPeriodData.reduce((s,d)=>s+d.likes,0);
  const totalComments = filteredPeriodData.reduce((s,d)=>s+d.comments,0);
  const hasStats      = totalViews + totalLikes + totalComments > 0;

  const maxViews = Math.max(...periodData.map(d=>d.views), 1);

  if (published.length === 0) return <div style={{textAlign:"center",padding:"60px 0",color:"#4b5563"}}>
    <div style={{fontSize:36,marginBottom:8}}>📭</div>
    <div style={{fontSize:12}}>Нет опубликованных материалов</div>
  </div>;

  const TH = ({children, w}) => <th style={{textAlign:"left",padding:"6px 10px",fontSize:9,color:"#4b5563",fontFamily:"monospace",fontWeight:700,borderBottom:"1px solid #1e1e2e",whiteSpace:"nowrap",width:w}}>{children}</th>;

  const Toolbar = () => <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
    {/* View toggle */}
    <div style={{display:"flex",background:"#111118",borderRadius:8,border:"1px solid #1e1e2e",overflow:"hidden"}}>
      {[["list","📋 Список"],["dashboard","📊 Дашборд"]].map(([v,l])=>
        <button key={v} onClick={()=>setView(v)} style={{padding:"5px 12px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:600,
          background:view===v?"#1e1e2e":"transparent",color:view===v?"#f0eee8":"#4b5563"}}>
          {l}
        </button>
      )}
    </div>
    {/* Group toggle */}
    <div style={{display:"flex",background:"#111118",borderRadius:8,border:"1px solid #1e1e2e",overflow:"hidden"}}>
      {[["week","По неделям"],["month","По месяцам"]].map(([v,l])=>
        <button key={v} onClick={()=>{setGroupBy(v);setSelectedPeriod("all");}} style={{padding:"5px 12px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:600,
          background:groupBy===v?"#10b98130":"transparent",color:groupBy===v?"#10b981":"#4b5563"}}>
          {l}
        </button>
      )}
    </div>
    {/* Period selector */}
    <select value={selectedPeriod} onChange={e=>setSelectedPeriod(e.target.value)} style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:8,color:selectedPeriod!=="all"?"#10b981":"#6b7280",fontSize:10,fontFamily:"monospace",padding:"5px 10px",cursor:"pointer",outline:"none"}}>
      <option value="all">Все периоды</option>
      {periodData.map(d=><option key={d.k} value={d.k}>{d.label}</option>)}
    </select>
    <div style={{flex:1}}/>
    <span style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>{published.reduce((s,x)=>s+pubCount(x),0)} публикаций · обновление в 07:00</span>
  </div>;

  // ── DASHBOARD VIEW ──────────────────────────────────────────────────────────
  if (view === "dashboard") {
    const StatCard = ({label, value, color, icon}) =>
      <div style={{flex:1,background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"18px 20px",minWidth:130}}>
        <div style={{fontSize:10,color:"#4b5563",fontFamily:"monospace",marginBottom:6}}>{icon} {label}</div>
        <div style={{fontSize:26,fontWeight:800,color,fontFamily:"monospace",letterSpacing:-1}}>{fmtFull(value)}</div>
      </div>;

    // Top 5 reels by views — from filtered period
    const ranked = filteredItems
      .map(x=>({...x, views: stats[x.id]?.views||0}))
      .filter(x=>x.views>0)
      .sort((a,b)=>b.views-a.views)
      .slice(0,5);

    return <div>
      <Toolbar/>
      {/* KPI cards */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <StatCard label="ПРОСМОТРЫ" value={totalViews} color="#06b6d4" icon="👁"/>
        <StatCard label="ЛАЙКИ" value={totalLikes} color="#ec4899" icon="❤️"/>
        <StatCard label="КОММЕНТАРИИ" value={totalComments} color="#8b5cf6" icon="💬"/>
        <StatCard label="ПУБЛИКАЦИИ" value={filteredItems.reduce((s,x)=>s+pubCount(x),0)} color="#10b981" icon="📹"/>
        {totalLikes>0&&totalViews>0&&<StatCard label="ERR (лайки/просм.)" value={(totalLikes/totalViews*100).toFixed(2)+"%"} color="#f59e0b" icon="📈"/>}
      </div>

      {/* Bar chart by period */}
      {hasStats && periodData.length > 0 && <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"16px 20px",marginBottom:20}}>
        <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",fontWeight:700,marginBottom:14}}>
          ПРОСМОТРЫ {groupBy==="week"?"ПО НЕДЕЛЯМ":"ПО МЕСЯЦАМ"}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {periodData.map(d => {
            const pct = Math.round(d.views/maxViews*100);
            const isSelected = selectedPeriod !== "all" && d.k === selectedPeriod;
            const isDimmed   = selectedPeriod !== "all" && d.k !== selectedPeriod;
            return <div key={d.k} onClick={()=>setSelectedPeriod(selectedPeriod===d.k?"all":d.k)}
              style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",opacity:isDimmed?0.35:1,transition:"opacity 0.2s"}}>
              <div style={{width:120,fontSize:9,color:isSelected?"#10b981":"#6b7280",fontFamily:"monospace",flexShrink:0,textAlign:"right",fontWeight:isSelected?700:400}}>{d.label}</div>
              <div style={{flex:1,height:20,background:"#0d0d16",borderRadius:4,overflow:"hidden",position:"relative"}}>
                <div style={{width:pct+"%",height:"100%",background:isSelected?"linear-gradient(90deg,#10b981,#06b6d4)":"linear-gradient(90deg,#06b6d4,#3b82f6)",borderRadius:4,transition:"width 0.4s"}}/>
              </div>
              <div style={{width:60,fontSize:10,fontFamily:"monospace",fontWeight:700,color:"#06b6d4",textAlign:"right"}}>{fmt(d.views)||"—"}</div>
              <div style={{width:50,fontSize:9,fontFamily:"monospace",color:"#ec4899",textAlign:"right"}}>{fmt(d.likes)||"—"}</div>
              <div style={{width:40,fontSize:9,fontFamily:"monospace",color:"#8b5cf6",textAlign:"right"}}>{fmt(d.comments)||"—"}</div>
              <div style={{width:30,fontSize:8,fontFamily:"monospace",color:"#4b5563",textAlign:"right"}}>{d.count}шт</div>
            </div>;
          })}
        </div>
        <div style={{display:"flex",gap:16,marginTop:10,justifyContent:"flex-end"}}>
          {[["#06b6d4","👁 Просмотры"],["#ec4899","❤️ Лайки"],["#8b5cf6","💬 Комм."]].map(([c,l])=>
            <span key={l} style={{fontSize:8,color:c,fontFamily:"monospace"}}>{l}</span>
          )}
          {selectedPeriod!=="all"&&<span onClick={()=>setSelectedPeriod("all")} style={{fontSize:8,color:"#4b5563",fontFamily:"monospace",cursor:"pointer",marginLeft:8}}>✕ сбросить фильтр</span>}
        </div>
      </div>}

      {/* Top reels */}
      {ranked.length > 0 && <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"16px 20px"}}>
        <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",fontWeight:700,marginBottom:12}}>ТОП РИЛСОВ ПО ПРОСМОТРАМ</div>
        {ranked.map((item,i)=>{
          const proj = projects.find(p=>p.id===item.project);
          const s = stats[item.id]||{};
          return <div key={item.id} onClick={()=>onOpen(item)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:i===0?"none":"1px solid #1e1e2e",cursor:"pointer"}}>
            <span style={{fontSize:16,fontWeight:800,color:"#1e1e2e",width:24,textAlign:"center",fontFamily:"monospace"}}>
              {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}
            </span>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</div>
              {proj&&<span style={{fontSize:8,color:proj.color,fontFamily:"monospace"}}>{proj.label}</span>}
            </div>
            <div style={{display:"flex",gap:16,flexShrink:0}}>
              <span style={{fontSize:11,fontWeight:700,color:"#06b6d4",fontFamily:"monospace"}}>{fmt(s.views)}</span>
              <span style={{fontSize:10,color:"#ec4899",fontFamily:"monospace"}}>{fmt(s.likes)}</span>
              <span style={{fontSize:10,color:"#8b5cf6",fontFamily:"monospace"}}>{fmt(s.comments)}</span>
            </div>
          </div>;
        })}
      </div>}

      {!hasStats && <div style={{textAlign:"center",padding:"40px",color:"#4b5563"}}>
        <div style={{fontSize:28,marginBottom:8}}>📊</div>
        <div style={{fontSize:12}}>Статистика ещё не собрана.<br/>Откройте карточку рилса и нажмите 🔄, или дождитесь 07:00.</div>
      </div>}
    </div>;
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return <div>
    <Toolbar/>
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      {keys.map(k => {
        const kItems = grouped[k];
        const label = k==="unknown" ? "Без даты" : groupBy==="week" ? getWeekLabel(k) : getMonthLabel(k);
        const weekTotal = kItems.reduce((s,x)=>s+pubCount(x),0);
        const starredCount = kItems.filter(x=>x.starred).reduce((s,x)=>s+pubCount(x),0);
        const periodViews = kItems.reduce((s,x)=>s+(stats[x.id]?.views||0),0);
        const periodLikes = kItems.reduce((s,x)=>s+(stats[x.id]?.likes||0),0);
        return <div key={k}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#10b981",fontFamily:"monospace"}}>{label}</span>
            <span style={{fontSize:9,background:"#10b98120",color:"#10b981",borderRadius:10,padding:"1px 8px",fontFamily:"monospace"}}>{weekTotal} публ.</span>
            {starredCount>0&&<span style={{fontSize:9,background:"#f59e0b20",color:"#f59e0b",borderRadius:10,padding:"1px 8px",fontFamily:"monospace"}}>★ {starredCount} залетевших</span>}
            {periodViews>0&&<span style={{fontSize:9,color:"#06b6d4",fontFamily:"monospace",marginLeft:4}}>👁 {fmt(periodViews)}</span>}
            {periodLikes>0&&<span style={{fontSize:9,color:"#ec4899",fontFamily:"monospace"}}>❤️ {fmt(periodLikes)}</span>}
            <div style={{flex:1,height:1,background:"#1e1e2e"}}/>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",background:"#111118",borderRadius:10,overflow:"hidden",border:"1px solid #1e1e2e"}}>
            <thead>
              <tr style={{background:"#0d0d16"}}>
                <TH w={28}>★</TH>
                <TH>НАЗВАНИЕ</TH>
                <TH w={130}>ПРОЕКТ</TH>
                <TH w={100}>ТИП</TH>
                <TH w={90}>КОЛ-ВО</TH>
                <TH w={100}>ДАТА</TH>
                <TH w={80}>👁 ПРОСМ.</TH>
                <TH w={70}>❤️ ЛАЙКИ</TH>
                <TH w={70}>💬 КОММ.</TH>
              </tr>
            </thead>
            <tbody>
              {kItems.map((item,i) => {
                const proj = projects.find(p=>p.id===item.project);
                const dateStr = item.completed_at || item.planned_date?.slice(0,10) || "";
                const cnt = pubCount(item);
                return <tr key={item.id} onClick={()=>onOpen(item)}
                  style={{borderTop:i===0?"none":"1px solid #1e1e2e",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"8px 10px",textAlign:"center"}} onClick={e=>{e.stopPropagation();onToggleStar&&onToggleStar(item);}}>
                    <span style={{fontSize:14,color:item.starred?"#f59e0b":"#2d2d44",cursor:"pointer",transition:"color 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.color=item.starred?"#d97706":"#6b7280"}
                      onMouseLeave={e=>e.currentTarget.style.color=item.starred?"#f59e0b":"#2d2d44"}>★</span>
                  </td>
                  <td style={{padding:"8px 10px",fontSize:12,fontWeight:600,color:"#f0eee8"}}>{item.title||"Без названия"}</td>
                  <td style={{padding:"8px 10px"}}>
                    {proj&&<span style={{fontSize:9,color:proj.color,background:proj.color+"18",borderRadius:4,padding:"2px 6px",fontFamily:"monospace"}}>{proj.label}</span>}
                  </td>
                  <td style={{padding:"8px 10px",fontSize:9,color:"#6b7280",fontFamily:"monospace"}}>
                    {item.pub_type==="carousel"?"🖼 Карусель":"🎬 Рилс"}
                  </td>
                  <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace",fontWeight:700,color:cnt>1?"#a78bfa":"#6b7280"}}>
                    {cnt>1?`× ${cnt}`:"—"}
                  </td>
                  <td style={{padding:"8px 10px",fontSize:9,color:"#10b981",fontFamily:"monospace"}}>{dateStr||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#06b6d4",fontSize:11}}>
                    {fmt(stats[item.id]?.views)||"—"}
                  </td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontWeight:700,color:"#ec4899",fontSize:11}}>
                    {fmt(stats[item.id]?.likes)||"—"}
                  </td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",color:"#8b5cf6",fontSize:11}}>
                    {fmt(stats[item.id]?.comments)||"—"}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>;
      })}
    </div>
  </div>;
}

// ── ProjectsView ─────────────────────────────────────────────────────────────
function ProjectsView({projects, preItems, prodItems, postReels, postVideo, postCarousels, pubItems, adminItems, onOpenTask}) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [expandedTypes, setExpandedTypes] = useState({});

  const allTasks = [
    ...preItems.map(t=>({...t,_type:"pre"})),
    ...prodItems.map(t=>({...t,_type:"prod"})),
    ...postReels.map(t=>({...t,_type:"post_reels"})),
    ...postVideo.map(t=>({...t,_type:"post_video"})),
    ...postCarousels.map(t=>({...t,_type:"post_carousel"})),
    ...pubItems.map(t=>({...t,_type:"pub"})),
    ...adminItems.map(t=>({...t,_type:"admin"})),
  ].filter(t=>!t.archived);

  const typeLabel = {
    pre:"Препродакшн", prod:"Продакшн", post_reels:"Пост — Рилс",
    post_video:"Пост — Видео", post_carousel:"Пост — Карусель",
    pub:"Публикация", admin:"Адм. задача"
  };
  const typeColor = {
    pre:"#8b5cf6", prod:"#3b82f6", post_reels:"#ec4899",
    post_video:"#3b82f6", post_carousel:"#a78bfa",
    pub:"#10b981", admin:"#f97316"
  };
  const statusColors = {
    idea:"#6b7280", script:"#8b5cf6", ready:"#06b6d4", scheduled:"#3b82f6",
    filming:"#f59e0b", filmed:"#10b981", editing:"#ec4899", review:"#f97316",
    approved:"#10b981", published:"#10b981", draft:"#6b7280", new:"#6b7280",
    in_progress:"#3b82f6", done:"#10b981", cancelled:"#ef4444"
  };

  const proj = selectedProject ? projects.find(p=>p.id===selectedProject) : null;
  const tasks = selectedProject
    ? allTasks.filter(t=>t.project===selectedProject)
    : allTasks;

  // Group by type
  const byType = {};
  tasks.forEach(t => {
    if (!byType[t._type]) byType[t._type] = [];
    byType[t._type].push(t);
  });

  function toggleType(type) {
    setExpandedTypes(p => ({...p, [type]: !p[type]}));
  }

  const activeProjects = projects.filter(p=>!p.archived);

  return <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
    {/* Left: project list */}
    <div style={{width:200,borderRight:"1px solid #1e1e2e",overflowY:"auto",flexShrink:0,padding:"12px 8px"}}>
      <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",fontWeight:700,marginBottom:8,padding:"0 6px"}}>ПРОЕКТЫ</div>
      <button onClick={()=>setSelectedProject(null)}
        style={{width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:4,
          background:!selectedProject?"#f59e0b20":"transparent",
          color:!selectedProject?"#f59e0b":"#9ca3af",fontFamily:"inherit",fontSize:11,fontWeight:!selectedProject?700:400}}>
        🗂 Все проекты
        <span style={{float:"right",fontSize:9,opacity:0.7}}>{allTasks.length}</span>
      </button>
      {activeProjects.map(p => {
        const cnt = allTasks.filter(t=>t.project===p.id).length;
        return <button key={p.id} onClick={()=>setSelectedProject(p.id)}
          style={{width:"100%",textAlign:"left",padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:2,
            background:selectedProject===p.id?p.color+"20":"transparent",
            color:selectedProject===p.id?p.color:"#9ca3af",fontFamily:"inherit",fontSize:11,fontWeight:selectedProject===p.id?700:400}}>
          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:p.color,marginRight:7,verticalAlign:"middle"}}/>
          {p.label}
          <span style={{float:"right",fontSize:9,opacity:0.7}}>{cnt}</span>
        </button>;
      })}
    </div>

    {/* Right: tasks */}
    <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        {proj
          ? <><span style={{width:12,height:12,borderRadius:"50%",background:proj.color,display:"inline-block"}}/>
              <span style={{fontSize:15,fontWeight:800,color:proj.color}}>{proj.label}</span></>
          : <span style={{fontSize:15,fontWeight:800,color:"#f0eee8"}}>Все проекты</span>}
        <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{tasks.length} задач</span>
      </div>

      {Object.keys(typeLabel).map(type => {
        const items = byType[type] || [];
        if (!items.length) return null;
        const isOpen = expandedTypes[type] !== false; // open by default
        const color = typeColor[type];
        return <div key={type} style={{marginBottom:12}}>
          <div onClick={()=>toggleType(type)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:isOpen?"8px 8px 0 0":8,cursor:"pointer",userSelect:"none"}}>
            <span style={{fontSize:9,color,fontFamily:"monospace",fontWeight:700,flex:1}}>{typeLabel[type].toUpperCase()}</span>
            <span style={{fontSize:9,background:color+"20",color,borderRadius:8,padding:"1px 8px",fontFamily:"monospace"}}>{items.length}</span>
            <span style={{fontSize:10,color:"#4b5563"}}>{isOpen?"▾":"▸"}</span>
          </div>
          {isOpen && <div style={{border:"1px solid #1e1e2e",borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
            {items.map((item,i) => {
              const sc = statusColors[item.status] || "#6b7280";
              const itemProj = !selectedProject ? projects.find(p=>p.id===item.project) : null;
              return <div key={item.id}
                onClick={()=>onOpenTask(item._type, item)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderTop:i===0?"none":"1px solid #1e1e2e",cursor:"pointer",background:"#0d0d16"}}
                onMouseEnter={e=>e.currentTarget.style.background="#111118"}
                onMouseLeave={e=>e.currentTarget.style.background="#0d0d16"}>
                <span style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/>
                <span style={{flex:1,fontSize:12,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</span>
                {itemProj&&<span style={{fontSize:9,color:itemProj.color,background:itemProj.color+"18",borderRadius:4,padding:"1px 7px",fontFamily:"monospace",flexShrink:0}}>{itemProj.label}</span>}
                <span style={{fontSize:9,color:sc,background:sc+"18",borderRadius:4,padding:"1px 7px",fontFamily:"monospace",flexShrink:0,whiteSpace:"nowrap"}}>{item.status}</span>
              </div>;
            })}
          </div>}
        </div>;
      })}

      {tasks.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:"#4b5563"}}>
        <div style={{fontSize:36,marginBottom:8}}>📂</div>
        <div style={{fontSize:12}}>Нет задач</div>
      </div>}
    </div>
  </div>;
}


function MainApp({currentUser, onLogout}){
  const [isMobile,setIsMobile]=useState(()=>window.innerWidth<=768);
  useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<=768);
    window.addEventListener("resize",fn);
    return()=>window.removeEventListener("resize",fn);
  },[]);

  const [tab,setTab]=useState("pre");
  const [viewMode,setViewMode]=useState("kanban");
  const [postSubTab,setPostSubTab]=useState("reels");
  const [pubViewMode,setPubViewMode]=useState("week");
  const [projects,setProjects]=useState([]);
  const [teamMembers,setTeamMembers]=useState([]);
  const [preItems,setPreItems]=useState([]);
  const [prodItems,setProdItems]=useState([]);
  const [postReels,setPostReels]=useState([]);
  const [postVideo,setPostVideo]=useState([]);
  const [postCarousels,setPostCarousels]=useState([]);
  const [pubItems,setPubItems]=useState([]);
  const [adminItems,setAdminItems]=useState([]);
  const [kpis,setKpis]=useState({});
  const [modal,setModal]=useState(null);
  const saveFnRef = useRef(null);
  // Stores object for useTaskStore — avoids repeated chains
  const stores = {preItems,setPreItems,prodItems,setProdItems,postReels,setPostReels,postVideo,setPostVideo,postCarousels,setPostCarousels,pubItems,setPubItems,adminItems,setAdminItems};
  const [loading,setLoading]=useState(true);
  const [notifs,setNotifs]=useState([]);
  const [showNotifs,setShowNotifs]=useState(false);
  const globalWsRef=useRef(null);

  // ── Load data from API ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const [projs, users, tasks] = await Promise.all([
          api.getProjects(),
          api.getUsers(),
          api.getTasks(),
        ]);
        setProjects(projs.map(p => ({...p, links: p.links || [], archived: p.archived || false})));
        // Load KPIs for sidebar analytics badge
        fetch("/api/analytics/kpi").then(r=>r.ok?r.json():[]).then(rows=>{
          const map={}; rows.forEach(r=>{map[`${r.project_id}_${r.year}_${r.month}`]=String(r.kpi);}); setKpis(map);
        }).catch(()=>{});
        setTeamMembers(users.map(u => ({...u, note: u.note || ""})));
        // Split tasks by type and merge data field
        const expand = t => {
          const d = t.data || {};
          return {
            id: t.id, project: t.project_id, status: t.status, title: t.title, type: t.type,
            completed_at: t.completed_at || "", starred: t.starred || false, chat: [],
            // safe array defaults to prevent crashes
            refs:         d.refs         || [],
            equipment:    d.equipment    || [],
            actors:       d.actors       || [],
            checklist:    d.checklist    || [],
            source_links: d.source_links || [],
            slides:       d.slides       || [],
            ...d,
            archived: t.archived || false, // column value always wins over data JSON
          };
        };
        setPreItems(tasks.filter(t=>t.type==="pre").map(expand));
        setProdItems(tasks.filter(t=>t.type==="prod").map(expand));
        setPostReels(tasks.filter(t=>t.type==="post_reels").map(expand));
        setPostVideo(tasks.filter(t=>t.type==="post_video").map(expand));
        setPostCarousels(tasks.filter(t=>t.type==="post_carousel").map(expand));
        setPubItems(tasks.filter(t=>t.type==="pub").map(expand));
        setAdminItems(tasks.filter(t=>t.type==="admin").map(expand));
      } catch(e) { console.error("Load error:", e); }
      setLoading(false);
    }
    loadAll();
  }, []);

  // ── Notifications: polling + WS ────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();

    const seenIds = new Set();

    function applyNotifs(rows) {
      const fresh = rows.filter(r => !seenIds.has(r.id));
      if (!fresh.length) return;
      fresh.forEach(r => seenIds.add(r.id));
      setNotifs(p => {
        const merged = [...fresh.map(r=>({id:r.id,kind:r.kind,taskId:r.task_id,taskType:r.task_type,title:r.title,text:r.body,ts:Number(r.created_at),read:r.read})), ...p].slice(0,50);
        return merged;
      });
      // Browser push for each new notif
      fresh.forEach(r => {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const body = r.kind === "chat_message" ? (r.body||"Новое сообщение") : "Новая задача назначена на вас";
          const n = new Notification("🍇 " + (r.title||"Виноград"), { body });
          n.onclick = () => { window.focus(); n.close(); };
        }
      });
    }

    // Initial load
    fetch("/api/notifications", { headers: { "x-user-id": currentUser.id } })
      .then(r => r.ok ? r.json() : []).then(applyNotifs).catch(()=>{});

    // Poll every 5 seconds
    const pollTimer = setInterval(() => {
      fetch("/api/notifications", { headers: { "x-user-id": currentUser.id } })
        .then(r => r.ok ? r.json() : []).then(applyNotifs).catch(()=>{});
    }, 5000);

    // WS as bonus (instant delivery when possible)
    const proto = location.protocol === "https:" ? "wss" : "ws";
    let ws;
    function connectWS() {
      ws = new WebSocket(`${proto}://${location.host}`);
      globalWsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "join_user", userId: currentUser.id }));
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== "notification") return;
          // Polling will pick it up, just trigger early fetch
          fetch("/api/notifications", { headers: { "x-user-id": currentUser.id } })
            .then(r => r.ok ? r.json() : []).then(applyNotifs).catch(()=>{});
        } catch {}
      };
      ws.onclose = () => { setTimeout(connectWS, 4000); };
    }
    connectWS();

    return () => {
      clearInterval(pollTimer);
      if (ws) ws.close();
    };
  }, [currentUser?.id]);

  // Per-tab filters — must be before any conditional return!
  const [preFilt,setPreFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [prodFilt,setProdFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [postFilt,setPostFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [pubFilt,setPubFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [showArchivedAdmin,setShowArchivedAdmin]=useState(false);
  const [adminFilt,setAdminFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [showArchivedPre,setShowArchivedPre]=useState(false);
  const [showArchivedProd,setShowArchivedProd]=useState(false);
  const [showArchivedPost,setShowArchivedPost]=useState(false);
  const [showArchivedPub,setShowArchivedPub]=useState(false);

  if (loading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,background:"#0a0a0f"}}>
      <div style={{fontSize:48}}>🍇</div>
      <div style={{fontSize:12,color:"#9ca3af",fontFamily:"monospace"}}>Загрузка...</div>
    </div>
  );

  const activeProjs=projects.filter(p=>!p.archived);

  function applyFilter(items,filt,memberFields=["producer","editor","scriptwriter","operator","designer"],showArchived=false){
    items=showArchived ? items.filter(x=>x.archived) : items.filter(x=>!x.archived);
    let r=items;
    if(filt.pf!=="all") r=r.filter(x=>x.project===filt.pf);
    if(filt.member!=="all") r=r.filter(x=>memberFields.some(f=>x[f]===filt.member));
    if(showArchived){ return [...r].sort((a,b)=>(b.completed_at||"").localeCompare(a.completed_at||"")); }
    if(filt.sortBy==="deadline") r=[...r].sort((a,b)=>(a.deadline||a.shoot_date||a.planned_date||"")>(b.deadline||b.shoot_date||b.planned_date||"")?1:-1);
    if(filt.sortBy==="project") r=[...r].sort((a,b)=>a.project>b.project?1:-1);
    if(filt.sortBy==="status") r=[...r].sort((a,b)=>a.status>b.status?1:-1);
    return r;
  }

  const filtPre=applyFilter(preItems,preFilt,undefined,showArchivedPre);
  const filtProd=applyFilter(prodItems,prodFilt,undefined,showArchivedProd);
  const filtPostReels=applyFilter(postReels,postFilt,undefined,showArchivedPost);
  const filtPostVideo=applyFilter(postVideo,postFilt,undefined,showArchivedPost);
  const filtPostCarousels=applyFilter(postCarousels,postFilt,undefined,showArchivedPost);
  const filtPub=applyFilter(pubItems,pubFilt,undefined,showArchivedPub);
  const filtAdmin=applyFilter(adminItems,adminFilt,undefined,showArchivedAdmin);

  const ct=TABS.find(t=>t.id===tab);

  function defItem(type,extra={}){
    const proj=activeProjs[0]?.id||"brandx";
    const base={pre:{id:genId(),title:"",type:"Сценарий",project:proj,status:"idea",brief:"",script:"",refs:[],deadline:"",scriptwriter:"",producer:"",chat:[]},
      prod:{id:genId(),title:"",type:"Рилс",project:proj,status:"planned",location:"",equipment:[],actors:[],shoot_date:"",checklist:[],producer:"",operator:"",chat:[]},
      post_reels:{id:genId(),title:"",project:proj,status:"not_started",source_name:"",source_url:"",transcript:"",tz:"",birolls:"",final_link:"",post_deadline:"",producer:"",editor:"",chat:[]},
      post_video:{id:genId(),title:"",project:proj,status:"not_started",source_links:[],tz:"",final_link:"",post_deadline:"",producer:"",editor:"",chat:[]},
      post_carousel:{id:genId(),title:"",project:proj,status:"not_started",slides:[{id:genId(),text:"",img:"",img_name:""}],cover_text:"",tz:"",final_link:"",post_deadline:"",producer:"",designer:"",chat:[]},
      pub:{id:genId(),title:"",project:proj,status:"draft",planned_date:"",caption:"",hashtags:"",producer:"",file_name:"",reels_count:1,pub_type:"video",chat:[]},
    };
    return {...base[type],...extra};
  }

  function openNew(type,extra={}){ setModal({type,item:defItem(type,extra)}); }
  function openEdit(type,item){
    if(item._toggleStar){ toggleStar(type,item); return; }
    const safe={
      refs:         item.refs         ?? [],
      equipment:    item.equipment    ?? [],
      actors:       item.actors       ?? [],
      checklist:    item.checklist    ?? [],
      source_links: item.source_links ?? [],
      slides:       item.slides?.length ? item.slides : [{id:genId(),text:"",img:"",img_name:""}],
      tz:           item.tz           ?? "",
      transcript:   item.transcript   ?? "",
      birolls:      item.birolls      ?? "",
      final_link:   item.final_link   ?? "",
      source_name:  item.source_name  ?? "",
      source_url:   item.source_url   ?? "",
      cover_text:   item.cover_text   ?? "",
      caption:      item.caption      ?? "",
      hashtags:     item.hashtags     ?? "",
      file_name:    item.file_name    ?? "",
      file_url:     item.file_url     ?? "",
      brief:        item.brief        ?? "",
      script:       item.script       ?? "",
      location:     item.location     ?? "",
      post_deadline:item.post_deadline?? "",
      deadline:     item.deadline     ?? "",
    };
    setModal({type, item:{...item,...safe}});
  }
  function close(){ setModal(null); }

  async function toggleStar(type, item){
    const newVal = !item.starred;
    // optimistic update
    const [,setter] = useTaskStore(type, stores);
    setter(p=>p.map(x=>x.id===item.id?{...x,starred:newVal}:x));
    try {
      const { id, project, status, title, chat, archived, ...rest } = {...item, starred:newVal};
      await api.updateTask(id, { type, title:title||"", project_id:project, status, archived:archived||false, data:{...rest,starred:newVal} });
    } catch(e){ console.error("toggleStar error:",e); }
  }

  async function save(type,d){
    try {
      const { id, project, status, title, chat, archived, ...rest } = d;
      const payload = { type, title: title||"", project_id: project||"none", status, archived: archived||false, data: rest };
      // Check if item exists already
      const [getter, setter] = useTaskStore(type, stores);
      const exists = getter.find(x=>x.id===id);
      if (exists) {
        await api.updateTask(id, payload);
        setter(p=>p.map(x=>x.id===id?d:x));
      } else {
        const saved = await api.createTask({...payload, id});
        const expanded = {id:saved.id,project:saved.project_id,status:saved.status,title:saved.title,archived:saved.archived||false,chat:[],...(saved.data||{})};
        setter(p=>[...p, expanded]);
      }
    } catch(e) { console.error("Save error:", e); alert("Ошибка сохранения: "+e.message); }
    close();
  }

  async function deleteTask(type,id){
    const [,setter] = useTaskStore(type, stores);
    try{ await api.deleteTask(id); setter(p=>p.filter(x=>x.id!==id)); close(); }
    catch(e){ alert("Ошибка удаления: "+e.message); }
  }

  function archiveTask(type,id){
    const [getter,setter] = useTaskStore(type, stores);
    const item=getter.find(x=>x.id===id);
    if(!item) return;
    const newVal=!item.archived;
    setter(p=>p.map(x=>x.id===id?{...x,archived:newVal}:x));
    api.updateTask(id,{archived:newVal}).catch(e=>console.error("Archive error:",e));
  }

  async function sendToPub(sourceType, sourceItem) {
    // Determine pub_type from source
    const pubType = sourceType==="post_carousel" ? "carousel" : "video";
    const reelsCount = sourceItem.reels_count || sourceItem.video_count || 1;
    const newPub = {
      id: genId(),
      title: sourceItem.title || "",
      project: sourceItem.project || "",
      status: "draft",
      pub_type: pubType,
      reels_count: reelsCount,
      producer: sourceItem.producer || "",
      planned_date: "",
      caption: "",
      hashtags: "",
      file_name: sourceItem.final_file_name || "",
      file_url: sourceItem.final_file_url || "",
      chat: [],
    };
    // Archive source task
    const [,srcSetter] = useTaskStore(sourceType, stores);
    srcSetter(p=>p.map(x=>x.id===sourceItem.id?{...x,archived:true}:x));
    api.updateTask(sourceItem.id,{archived:true}).catch(e=>console.error("Archive error:",e));
    // Open pub modal pre-filled
    close();
    setTimeout(()=>setModal({type:"pub", item:newPub}), 50);
  }
  function drop(type,id,newStatus){
    const DONE_STATUSES=["done","approved","published"];
    const completedAt=DONE_STATUSES.includes(newStatus)?new Date().toISOString().slice(0,10):"";
    const [,setterDrop] = useTaskStore(type, stores);
    setterDrop(p=>p.map(x=>x.id===id?{...x,status:newStatus,completed_at:completedAt}:x));
    const patch={status:newStatus};
    if(completedAt) patch.completed_at=completedAt;
    api.updateTask(id, patch).catch(e=>console.error("Drop error:",e));
    if(type==="pub" && newStatus==="published") setPubViewMode("published");
  }

  function moveToDay(type,id,newDate){
    const field=type==="prod"?"shoot_date":"planned_date";
    const upd=setter=>setter(p=>p.map(x=>x.id===id?{...x,[field]:newDate}:x));
    if(type==="prod") upd(setProdItems);
    else if(type==="pub") upd(setPubItems);
    // get current item data and patch
    const [getter2] = useTaskStore(type, stores);
    const item=getter2.find(x=>x.id===id);
    const [,setter2] = useTaskStore(type, stores);
    setter2(p=>p.map(x=>x.id===id?{...x,[field]:newDate}:x));
    if(item){ const {id:_id,project,status,title,chat,...rest}=item; api.updateTask(id,{data:{...rest,[field]:newDate}}).catch(e=>console.error(e)); }
  }

  function mkCard(item,type){
    const proj=projOf(item.project,projects);
    const chatCount=(item.chat||[]).length;
    const custId=item.customer||item.producer||"";
    const execId=item.executor||item.editor||item.scriptwriter||item.operator||item.designer||"";
    const cust=teamOf(custId,teamMembers);
    const exec=teamOf(execId,teamMembers);
    const dateStr=item.deadline||item.shoot_date?.slice(0,10)||item.planned_date?.slice(0,10)||item.post_deadline||"";
    const daysLeft=dateStr?Math.ceil((new Date(dateStr).getTime()-Date.now())/86400000):null;
    const urgent=daysLeft!==null&&daysLeft<=2;
    return <div onClick={()=>openEdit(type,item)} style={{background:"#111118",borderTop:`1px solid ${item.starred?"#f59e0b50":urgent?"#ef444450":"#1e1e2e"}`,borderRight:`1px solid ${item.starred?"#f59e0b50":urgent?"#ef444450":"#1e1e2e"}`,borderBottom:`1px solid ${item.starred?"#f59e0b50":urgent?"#ef444450":"#1e1e2e"}`,borderLeft:`3px solid ${item.starred?"#f59e0b":urgent?"#ef4444":"#374151"}`,borderRadius:8,padding:"10px 11px",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.background="#16161f"} onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
      <div style={{display:"flex",alignItems:"flex-start",gap:5,marginBottom:5}}>
        <div style={{fontWeight:700,fontSize:12,flex:1}}>{item.title||"Без названия"}</div>
        {type==="pub"&&<button onClick={e=>{e.stopPropagation();toggleStar(type,item);}} title="Залётный рилс"
          style={{background:"transparent",border:"none",cursor:"pointer",fontSize:15,padding:0,flexShrink:0,color:item.starred?"#f59e0b":"#2d2d44",lineHeight:1}}
          onMouseEnter={e=>e.currentTarget.style.color=item.starred?"#d97706":"#6b7280"}
          onMouseLeave={e=>e.currentTarget.style.color=item.starred?"#f59e0b":"#2d2d44"}>★</button>}
      </div>
      <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
        <Badge color="#374151">{proj.label}</Badge>
        {type==="pub"&&<Badge color={item.pub_type==="carousel"?"#a78bfa":"#3b82f6"}>{item.pub_type==="carousel"?"🖼 Карусель":`🎬 Рилс${(item.reels_count||1)>1?" ×"+(item.reels_count||1):""}`}</Badge>}
        {type==="post_reels"&&<Badge color="#ec4899">🎞 Рилс</Badge>}
        {type==="post_video"&&<Badge color="#3b82f6">🎬 Видео</Badge>}
        {type==="post_carousel"&&<Badge color="#a78bfa">🖼 Карусель</Badge>}
        {type==="post_carousel"&&item.slides&&item.slides.length>0&&<Badge color="#4b5563">📋 {item.slides.length} сл.</Badge>}
      </div>
      {/* Заказчик → Исполнитель */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:9,color:"#9ca3af"}}>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:cust?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{cust?cust.name:"заказчик"}</span>
        <span style={{color:"#9ca3af",flexShrink:0}}>→</span>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:exec?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{exec?exec.name:"исполнитель"}</span>
      </div>
      {/* Дедлайн */}
      {item.completed_at&&item.status==="done"&&<div style={{fontSize:9,fontFamily:"monospace",color:"#10b981"}}>✅ Выполнено {item.completed_at}</div>}
      {!item.completed_at&&dateStr&&<div style={{fontSize:9,fontFamily:"monospace",color:urgent?"#ef4444":"#4b5563"}}>📅 {dateStr}{daysLeft!==null&&` (${daysLeft>0?daysLeft+"д":"сегодня"})`}</div>}
      <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center"}}>
        {chatCount>0&&<span style={{fontSize:9,color:"#9ca3af"}}>💬 {chatCount}</span>}
        {(type==="post_reels"||type==="post_video"||type==="post_carousel")&&item.status==="done"&&<button onClick={e=>{
          e.stopPropagation();
          // Mark post task as done
          drop(type,item.id,"done");
          // Create new pub task carrying over final file/link
          const isCarousel = type==="post_carousel";
          const pubItem=defItem("pub",{
            title:item.title,
            project:item.project,
            pub_type:isCarousel?"carousel":"video",
            file_name:item.final_file_name||(isCarousel?"":item.source_name)||"",
            file_url:item.final_file_url||(isCarousel?"":item.source_url)||"",
            slides:isCarousel?(item.slides||[]):[],
          });
          setModal({type:"pub",item:pubItem});
        }} style={{background:"transparent",border:"1px dashed #10b98140",borderRadius:5,padding:"2px 7px",color:"#10b981",cursor:"pointer",fontSize:9}}>🚀 → Публ.</button>}
        {item.archived&&<Badge color="#4b5563">📦 архив</Badge>}
        {(item.archived||["done","approved","published","cancelled"].includes(item.status))&&<button onClick={e=>{e.stopPropagation();archiveTask(type,item.id);}} title={item.archived?"Из архива":"В архив"} style={{marginLeft:"auto",background:"transparent",border:"none",color:item.archived?"#10b981":"#6b7280",cursor:"pointer",fontSize:10,padding:"0 2px"}}>{item.archived?"↩":"📦"}</button>}
      </div>
    </div>;
  }

  const _now = new Date();
  const _curMonth = _now.getMonth(), _curYear = _now.getFullYear();
  const _myId = currentUser?.id;
  const _mf = ["executor","editor","scriptwriter","operator","designer"];
  const _pubThisMonth = pubItems.filter(x=>{ const d=x.planned_date||""; if(!d) return false; const dt=new Date(d); return dt.getMonth()===_curMonth&&dt.getFullYear()===_curYear&&x.status==="published"; }).length;
  const _totalKpi = projects.filter(p=>!p.archived).reduce((s,p)=>s+(parseInt(kpis[`${p.id}_${_curYear}_${_curMonth}`]||"0")||0),0);
  const _kpiPct = _totalKpi>0 ? Math.round((_pubThisMonth/_totalKpi)*100) : null;
  const cnt={
    pre:   preItems.filter(t=>!t.archived&&t.status!=="approved").length,
    prod:  prodItems.filter(t=>!t.archived&&t.status!=="done").length,
    post:  [...postReels,...postVideo,...postCarousels].filter(t=>!t.archived&&t.status!=="done").length,
    pub:   pubItems.filter(t=>!t.archived&&t.status==="scheduled").length,
    admin: adminItems.filter(t=>!t.archived&&t.status!=="done"&&t.status!=="cancelled").length,
    summary: _myId ? [...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...adminItems].filter(t=>!t.archived&&_mf.some(f=>t[f]===_myId)).length : 0,
    analytics: _kpiPct,
    base: 0,
  };

  // ── Mobile stores object ─────────────────────────────────────────────────
  const mobileStores = {
    preItems,prodItems,postReels,postVideo,postCarousels,pubItems,
    setProjects,setTeam:setTeamMembers,setPubItems,
    projects,teamMembers,modal,
    openEdit,openNew,close,save,deleteTask,sendToPub,
  };

  if(isMobile) return <ErrorBoundary key="mobile"><MobileApp currentUser={currentUser} onLogout={onLogout} stores={mobileStores}/></ErrorBoundary>;

  const TASK_TABS = TABS.filter(t=>!["summary","analytics","base"].includes(t.id));
  const META_TABS = TABS.filter(t=>["summary","analytics","base"].includes(t.id));

  return <div style={{fontFamily:"'Syne','Inter',sans-serif",height:"100vh",background:"#0a0a0f",color:"#f0eee8",display:"flex",overflow:"hidden"}}>
    {/* LEFT SIDEBAR */}
    <div style={{width:220,flexShrink:0,background:"#0d0d16",borderRight:"1px solid #1a1a2e",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Logo */}
      <div style={{padding:"16px 16px 12px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#7c3aed,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🍇</div>
        <div>
          <div style={{fontSize:13,fontWeight:800,letterSpacing:"-0.3px"}}>{APP_NAME}</div>
          <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>production system</div>
        </div>
      </div>
      {/* Nav */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        <div style={{fontSize:9,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase",padding:"8px 8px 4px",fontFamily:"monospace"}}>Задачи</div>
        {TASK_TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setViewMode("kanban");}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"pointer",marginBottom:2,background:tab===t.id?t.color+"15":"transparent",border:"none",color:tab===t.id?t.color:"#9ca3af",fontFamily:"inherit",fontWeight:tab===t.id?700:500,fontSize:12,textAlign:"left",position:"relative"}}>
            {tab===t.id&&<div style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:2,borderRadius:2,background:t.color}}/>}
            <span style={{flex:1}}>{t.label}</span>
            {cnt[t.id]!=null&&cnt[t.id]!==0&&<span style={{fontSize:9,background:tab===t.id?t.color+"25":"#1a1a2e",borderRadius:20,padding:"0 6px",color:tab===t.id?t.color:"#4b5563",fontFamily:"monospace",fontWeight:700}}>{cnt[t.id]}{t.id==="analytics"?"%":""}</span>}
          </button>
        ))}
        <div style={{fontSize:9,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase",padding:"12px 8px 4px",fontFamily:"monospace"}}>Обзор</div>
        {META_TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setViewMode("kanban");}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"pointer",marginBottom:2,background:tab===t.id?t.color+"15":"transparent",border:"none",color:tab===t.id?t.color:"#9ca3af",fontFamily:"inherit",fontWeight:tab===t.id?700:500,fontSize:12,textAlign:"left",position:"relative"}}>
            {tab===t.id&&<div style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:2,borderRadius:2,background:t.color}}/>}
            <span style={{flex:1}}>{t.label}</span>
          </button>
        ))}
      </div>
      {/* User footer */}
      <div style={{borderTop:"1px solid #1a1a2e",padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:"#1e1e2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#9ca3af",flexShrink:0}}>{(currentUser?.name||currentUser?.telegram||"?")[0].toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.name||"@"+currentUser?.telegram}</div>
            <div style={{fontSize:9,color:"#4b5563"}}>{currentUser?.role||"Участник"}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{width:"100%",marginTop:6,background:"transparent",border:"1px solid #1e1e2e",borderRadius:7,padding:"5px",color:"#4b5563",cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:600}}>Выйти</button>
      </div>
    </div>

    {/* MAIN COLUMN */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
    {/* TOP BAR — notifications + current tab title */}
    <div style={{borderBottom:"1px solid #1a1a2e",background:"#0d0d16",flexShrink:0,padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:2,height:52}}>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15,fontWeight:800,color:TABS.find(t=>t.id===tab)?.color||"#f0eee8"}}>{TABS.find(t=>t.id===tab)?.label||""}</span>
          {!["summary","analytics","base"].includes(tab)&&cnt[tab]>0&&<span style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>· {cnt[tab]}</span>}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,position:"relative"}}>
          {/* 🔔 Bell */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowNotifs(p=>!p)} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:16,position:"relative"}}>
              🔔
              {notifs.filter(n=>!n.read).length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",borderRadius:"50%",fontSize:9,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{notifs.filter(n=>!n.read).length}</span>}
            </button>
            {showNotifs&&<div style={{position:"absolute",top:36,right:0,width:320,background:"#111118",border:"1px solid #2d2d44",borderRadius:12,boxShadow:"0 8px 32px #00000080",zIndex:1000,maxHeight:420,overflowY:"auto"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #1e1e2e"}}>
                <span style={{fontSize:11,fontWeight:700,color:"#f0eee8"}}>🔔 Уведомления</span>
                {notifs.length>0&&<button onClick={()=>{setNotifs([]);fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({})}).catch(()=>{});}} style={{background:"transparent",border:"none",color:"#4b5563",cursor:"pointer",fontSize:10}}>Очистить все</button>}
              </div>
              {notifs.length===0&&<div style={{padding:"24px 14px",textAlign:"center",color:"#4b5563",fontSize:11}}>Нет уведомлений</div>}
              {notifs.map(n=>{
                const taskType=n.taskType||"pre";
                const typeLabel=taskType==="pre"?"Препродакшн":taskType==="prod"?"Продакшн":taskType==="pub"?"Публикация":"Постпродакшн";
                return <div key={n.id} onClick={()=>{
                  setNotifs(p=>p.filter(x=>x.id!==n.id));
                  fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({id:n.id})}).catch(()=>{});
                  if(n.taskId){
                    const type=n.taskType||"pre";
                    const tabId=type==="pre"?"pre":type==="prod"?"prod":type.startsWith("post")?"post":"pub";
                    setTab(tabId);
                    const allIt=[...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...pubItems];
                    const found=allIt.find(x=>x.id===n.taskId);
                    if(found) openEdit(type,found);
                  }
                  setShowNotifs(false);
                }} style={{padding:"10px 14px",borderBottom:"1px solid #0d0d16",cursor:"pointer",background:n.read?"transparent":"#0d0d16",display:"flex",gap:10,alignItems:"flex-start"}}
                onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
                onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":"#0d0d16"}>
                  <span style={{fontSize:16,flexShrink:0}}>{n.kind==="chat_message"?"💬":"📋"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
                    {n.text&&<div style={{fontSize:10,color:"#9ca3af",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.text}</div>}
                    <div style={{fontSize:9,color:"#4b5563",marginTop:3,fontFamily:"monospace"}}>{typeLabel} · {Number(n.ts)>1000000000?new Date(Number(n.ts)).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}):""}</div>
                  </div>
                  {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#8b5cf6",flexShrink:0,marginTop:4}}/>}
                </div>;
              })}
            </div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,background:"#111118",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:`linear-gradient(135deg,${currentUser.color||"#8b5cf6"},#7c3aed)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}}>{(currentUser.name||currentUser.telegram||"?")[0].toUpperCase()}</div>
            <span style={{fontSize:11,fontWeight:600}}>@{currentUser.telegram}</span>
          </div>
          <button onClick={onLogout} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Выйти</button>
        </div>
      </div>
    </div>

    {/* Click outside to close notifs */}
    {showNotifs&&<div onClick={()=>setShowNotifs(false)} style={{position:"fixed",inset:0,zIndex:999}}/>}
    {/* CONTENT */}
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"14px 6px"}}>

      {/* PRE */}
      {tab==="pre"&&<>
        <FilterBar pf={preFilt.pf} setPf={v=>setPreFilt(p=>({...p,pf:v}))} member={preFilt.member} setMember={v=>setPreFilt(p=>({...p,member:v}))} sortBy={preFilt.sortBy} setSortBy={v=>setPreFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Сценарий" onAdd={()=>openNew("pre")} showArchived={showArchivedPre} onArchiveToggle={()=>setShowArchivedPre(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"kanban",l:"Канбан"},{id:"calendar",l:"Календарь"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?"#8b5cf620":"transparent",border:viewMode===v.id?"1px solid #8b5cf640":"1px solid #1e1e2e",color:viewMode===v.id?"#8b5cf6":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {viewMode==="kanban"&&<Kanban statuses={PRE_STATUSES} items={filtPre} renderCard={x=>mkCard(x,"pre")} onDrop={(id,st)=>drop("pre",id,st)} onAddClick={st=>openNew("pre",{status:st})}/>}
        {viewMode==="calendar"&&<CalView items={filtPre} dateField="deadline" onDayClick={d=>openNew("pre",{deadline:d})} color="#8b5cf6" onMoveToDay={(id,day)=>{ setPreItems(p=>p.map(x=>x.id===id?{...x,deadline:day}:x)); const item=preItems.find(x=>x.id===id); if(item){const{id:_,project,status,title,chat,...rest}=item;api.updateTask(id,{data:{...rest,deadline:day}}).catch(()=>{});}}} renderChip={x=>{const p=projOf(x.project,projects);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("pre",x);}} style={{background:p.color+"18",border:`1px solid ${p.color}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:p.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.title}</div>;}}/>}
      </>}

      {/* PROD */}
      {tab==="prod"&&<>
        <FilterBar pf={prodFilt.pf} setPf={v=>setProdFilt(p=>({...p,pf:v}))} member={prodFilt.member} setMember={v=>setProdFilt(p=>({...p,member:v}))} sortBy={prodFilt.sortBy} setSortBy={v=>setProdFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Съёмка" onAdd={()=>openNew("prod")} showArchived={showArchivedProd} onArchiveToggle={()=>setShowArchivedProd(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"kanban",l:"Канбан"},{id:"calendar",l:"Съёмки"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?"#3b82f620":"transparent",border:viewMode===v.id?"1px solid #3b82f640":"1px solid #1e1e2e",color:viewMode===v.id?"#3b82f6":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {viewMode==="kanban"&&<Kanban statuses={PROD_STATUSES} items={filtProd} renderCard={x=>mkCard(x,"prod")} onDrop={(id,st)=>drop("prod",id,st)} onAddClick={st=>openNew("prod",{status:st})}/>}
        {viewMode==="calendar"&&<CalView items={filtProd} dateField="shoot_date" onDayClick={d=>openNew("prod",{shoot_date:d+"T10:00"})} color="#3b82f6" onMoveToDay={(id,day)=>moveToDay("prod",id,day+"T10:00")} renderChip={x=>{const p=projOf(x.project,projects);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("prod",x);}} style={{background:p.color+"18",border:`1px solid ${p.color}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:p.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🎬 {x.title}</div>;}}/>}
      </>}

      {/* POST */}
      {tab==="post"&&<>
        <FilterBar pf={postFilt.pf} setPf={v=>setPostFilt(p=>({...p,pf:v}))} member={postFilt.member} setMember={v=>setPostFilt(p=>({...p,member:v}))} sortBy={postFilt.sortBy} setSortBy={v=>setPostFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers}
          addLabel={postSubTab==="reels"?"Рилс":postSubTab==="video"?"Видео":"Карусель"}
          onAdd={()=>openNew(postSubTab==="reels"?"post_reels":postSubTab==="video"?"post_video":"post_carousel")} showArchived={showArchivedPost} onArchiveToggle={()=>setShowArchivedPost(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[["reels","🎞️ Рилсы","#ec4899"],["video","🎬 Видео","#3b82f6"],["carousel","🖼 Карусели","#a78bfa"]].map(([id,l,c])=><button key={id} onClick={()=>setPostSubTab(id)} style={{padding:"4px 11px",borderRadius:6,cursor:"pointer",background:postSubTab===id?c+"20":"transparent",border:postSubTab===id?`1px solid ${c}40`:"1px solid #1e1e2e",color:postSubTab===id?c:"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:600}}>{l}</button>)}
        </div>
        {postSubTab==="reels"&&<Kanban statuses={POST_STATUSES} items={filtPostReels} renderCard={x=>mkCard(x,"post_reels")} onDrop={(id,st)=>drop("post_reels",id,st)} onAddClick={st=>openNew("post_reels",{status:st})}/>}
        {postSubTab==="video"&&<Kanban statuses={POST_STATUSES} items={filtPostVideo} renderCard={x=>mkCard(x,"post_video")} onDrop={(id,st)=>drop("post_video",id,st)} onAddClick={st=>openNew("post_video",{status:st})}/>}
        {postSubTab==="carousel"&&<Kanban statuses={POST_STATUSES} items={filtPostCarousels} renderCard={x=>mkCard(x,"post_carousel")} onDrop={(id,st)=>drop("post_carousel",id,st)} onAddClick={st=>openNew("post_carousel",{status:st})}/>}
      </>}

      {/* PUB */}
      {tab==="pub"&&<>
        <FilterBar pf={pubFilt.pf} setPf={v=>setPubFilt(p=>({...p,pf:v}))} member={pubFilt.member} setMember={v=>setPubFilt(p=>({...p,member:v}))} sortBy={pubFilt.sortBy} setSortBy={v=>setPubFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Публикацию" onAdd={()=>openNew("pub")} showArchived={showArchivedPub} onArchiveToggle={()=>setShowArchivedPub(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"week",l:"Неделя"},{id:"calendar",l:"Месяц"},{id:"status",l:"По статусам"},{id:"published",l:"Опубликованные"}].map(v=><button key={v.id} onClick={()=>setPubViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:pubViewMode===v.id?"#10b98120":"transparent",border:pubViewMode===v.id?"1px solid #10b98140":"1px solid #1e1e2e",color:pubViewMode===v.id?"#10b981":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {pubViewMode==="week"&&<div style={{overflow:"hidden",width:"100%"}}><WeekView items={filtPub} onItemClick={x=>openEdit("pub",x)} onDayClick={dt=>openNew("pub",{planned_date:dt})} projects={projects} onMoveToDay={(id,dt)=>moveToDay("pub",id,dt)} onToggleStar={x=>toggleStar("pub",x)}/></div>}
        {pubViewMode==="calendar"&&<CalView items={filtPub} dateField="planned_date" onDayClick={d=>openNew("pub",{planned_date:d+"T12:00"})} color="#10b981" onMoveToDay={(id,day)=>moveToDay("pub",id,day+"T12:00")} renderChip={x=>{const sc=stColor(PUB_STATUSES,x.status);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("pub",x);}} style={{background:sc+"18",border:`1px solid ${sc}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:sc,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.title}</div>;}}/>}
        {pubViewMode==="status"&&<Kanban statuses={PUB_STATUSES.filter(s=>s.id!=="published")} items={filtPub.filter(x=>x.status!=="published")} onDrop={(id,st)=>drop("pub",id,st)} onAddClick={st=>openNew("pub",{status:st})} renderCard={x=>mkCard(x,"pub")}/>}
        {pubViewMode==="published"&&<PublishedView items={pubItems} projects={projects} onOpen={x=>openEdit("pub",x)} onToggleStar={x=>toggleStar("pub",x)}/>}
      </>}

      {tab==="admin"&&<>
        <FilterBar pf={adminFilt.pf} setPf={v=>setAdminFilt(p=>({...p,pf:v}))} member={adminFilt.member} setMember={v=>setAdminFilt(p=>({...p,member:v}))} sortBy={adminFilt.sortBy} setSortBy={v=>setAdminFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Задачу" onAdd={()=>openNew("admin")} showArchived={showArchivedAdmin} onArchiveToggle={()=>setShowArchivedAdmin(p=>!p)}/>
        <Kanban statuses={ADMIN_STATUSES} items={filtAdmin} renderCard={x=>mkCard(x,"admin")} onDrop={(id,st)=>drop("admin",id,st)} onAddClick={st=>openNew("admin",{status:st})}/>
      </>}
            {tab==="summary"&&<SummaryView preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems} projects={projects} team={teamMembers} currentUser={currentUser} onOpenTask={(type,item)=>openEdit(type,item)}/>}
      {tab==="analytics"&&<AnalyticsView pubItems={pubItems} projects={projects} kpisData={kpis}/>}
      {tab==="board"&&<div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><IntellectBoard projects={projects} currentUser={currentUser}/></div>}
      {tab==="projects"&&<div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><ProjectsView projects={projects} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems} onOpenTask={(type,item)=>openEdit(type,item)}/></div>}
      {tab==="base"&&<ErrorBoundary key="base"><BaseView projects={projects} setProjects={setProjects} teamMembers={teamMembers} setTeamMembers={setTeamMembers} currentUser={currentUser}/></ErrorBoundary>}
    </div>

    {/* MODALS */}
    {modal?.type==="pre"          &&<Modal title="Препродакшн — Сценарий"  color="#8b5cf6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pre",modal.item.id):undefined}><PreForm          item={modal.item} onSave={d=>save("pre",d)} onDelete={id=>deleteTask("pre",id)}           onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="prod"         &&<Modal title="Продакшн — Съёмка"       color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("prod",modal.item.id):undefined}><ProdForm         item={modal.item} onSave={d=>save("prod",d)} onDelete={id=>deleteTask("prod",id)}          onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="post_reels"   &&<Modal title="Постпродакшн — Рилс"    color="#ec4899" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_reels",modal.item.id):undefined}><PostReelsForm    item={modal.item} onSave={d=>save("post_reels",d)} onDelete={id=>deleteTask("post_reels",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_reels",d)}/></Modal>}
    {modal?.type==="post_video"   &&<Modal title="Постпродакшн — Видео"    color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_video",modal.item.id):undefined}><PostVideoForm    item={modal.item} onSave={d=>save("post_video",d)} onDelete={id=>deleteTask("post_video",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_video",d)}/></Modal>}
    {modal?.type==="post_carousel"&&<Modal title="Постпродакшн — Карусель" color="#a78bfa" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_carousel",modal.item.id):undefined}><PostCarouselForm item={modal.item} onSave={d=>save("post_carousel",d)} onDelete={id=>deleteTask("post_carousel",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} onSendToPub={d=>sendToPub("post_carousel",d)}/></Modal>}
    {modal?.type==="admin"        &&<Modal title="Административная задача" color="#f97316" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("admin",modal.item.id):undefined}><AdminForm item={modal.item} onSave={d=>save("admin",d)} onDelete={id=>deleteTask("admin",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="pub"          &&<Modal title="Публикация"               color="#10b981" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pub",modal.item.id):undefined}><PubForm          item={modal.item} onSave={d=>save("pub",d)} onDelete={id=>deleteTask("pub",id)}           onClose={close} saveFnRef={saveFnRef} projects={projects} team={teamMembers} currentUser={currentUser}/></Modal>}
    </div>{/* /MAIN COLUMN */}
  </div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE APP
// ═══════════════════════════════════════════════════════════════════════════════

const M = {
  sh: { background:"#0d0d14", padding:"14px 16px 10px", flexShrink:0, borderBottom:"1px solid #111118" },
  shRow: { display:"flex", alignItems:"center", gap:10 },
  title: { fontSize:20, fontWeight:800, color:"#f0eee8" },
  sub: { fontSize:11, color:"#4b5563", fontFamily:"monospace", marginTop:2 },
  actionBtn: { background:"linear-gradient(135deg,#7c3aed,#ec4899)", border:"none", borderRadius:12, padding:"8px 16px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", flexShrink:0 },
  scroll: { flex:1, overflowY:"auto", overflowX:"hidden", WebkitOverflowScrolling:"touch" },
  pad: { padding:"14px 16px" },
  card: { background:"#111118", border:"1px solid #1a1a2e", borderRadius:16, padding:"14px 16px", marginBottom:10, cursor:"pointer", position:"relative", overflow:"hidden" },
  cardTitle: { fontSize:14, fontWeight:700, color:"#f0eee8", marginBottom:8, lineHeight:1.35 },
  tags: { display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 },
  tag: { fontSize:10, padding:"3px 9px", borderRadius:8, fontFamily:"monospace", fontWeight:600, background:"#1a1a2e", color:"#6b7280", border:"1px solid #242438" },
  cfoot: { display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4 },
  avs: { display:"flex" },
  av: { width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff", border:"2px solid #0d0d14", marginLeft:-6, flexShrink:0 },
  secH: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  secT: { fontSize:11, fontWeight:800, color:"#4b5563", fontFamily:"monospace", letterSpacing:"0.08em" },
  chip: { flexShrink:0, padding:"7px 14px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", background:"#111118", border:"1px solid #1e1e2e", color:"#4b5563", fontFamily:"inherit", whiteSpace:"nowrap" },
  chipOn: { background:"#8b5cf618", borderColor:"#8b5cf655", color:"#a78bfa" },
  chipGreen: { background:"#10b98118", borderColor:"#10b98155", color:"#10b981" },
  row: { display:"flex", alignItems:"center", gap:10 },
};

const STATUS_COLOR_KEY = c => c==="#10b981"?"green":c==="#f59e0b"?"yellow":c==="#8b5cf6"?"purple":c==="#3b82f6"?"blue":c==="#ef4444"?"red":"grey";

function MTag({children, color}){
  const colorMap = {
    grey:{bg:"#6b728018",c:"#6b7280",b:"#6b728030"},
    yellow:{bg:"#f59e0b18",c:"#f59e0b",b:"#f59e0b30"},
    purple:{bg:"#8b5cf618",c:"#a78bfa",b:"#8b5cf630"},
    green:{bg:"#10b98118",c:"#10b981",b:"#10b98130"},
    blue:{bg:"#3b82f618",c:"#60a5fa",b:"#3b82f630"},
    red:{bg:"#ef444418",c:"#ef4444",b:"#ef444430"},
    pink:{bg:"#ec489918",c:"#ec4899",b:"#ec489930"},
  };
  const col = colorMap[color] || colorMap.grey;
  return <span style={{...M.tag, background:col.bg, color:col.c, borderColor:col.b}}>{children}</span>;
}

// ── Статус-бейдж ──────────────────────────────────────────────────────────────
function MStatusBadge({status, statuses}){
  const st = statuses.find(s=>s.id===status)||{l:status,c:"#6b7280"};
  return <MTag color={STATUS_COLOR_KEY(st.c)}>{st.l}</MTag>;
}

// ── Аватар ────────────────────────────────────────────────────────────────────
function MAvatar({member, size=28}){
  if(!member) return null;
  return <div style={{width:size,height:size,borderRadius:"50%",background:member.color||"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,fontWeight:800,color:"#fff",border:"2px solid #0d0d14",flexShrink:0}}>{(member.name||"?")[0].toUpperCase()}</div>;
}

// ── Карточка задачи ───────────────────────────────────────────────────────────
function MTaskCard({item, type, projects, team, onOpen}){
  const ALL_STATUSES = [...PRE_STATUSES,...PROD_STATUSES,...POST_STATUSES,...PUB_STATUSES];
  const st = ALL_STATUSES.find(s=>s.id===item.status)||{l:item.status,c:"#6b7280"};
  const proj = projects.find(p=>p.id===item.project)||{label:"",color:"#6b7280"};
  const typeMap = {pre:"✍️",prod:"🎬",post_reels:"🎞",post_video:"📹",post_carousel:"🖼",pub:"🚀"};
  const dateStr = item.deadline||item.shoot_date||item.planned_date||item.post_deadline||"";
  const memberIds = ["producer","editor","scriptwriter","operator","designer","customer","executor"].map(f=>item[f]).filter(Boolean);
  const members = [...new Set(memberIds)].slice(0,4).map(id=>team.find(m=>m.id===id)).filter(Boolean);

  return (
    <div style={{...M.card, borderLeft:`3px solid ${proj.color||"#6b7280"}`}} onClick={()=>onOpen(type,item)}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
        <span style={{fontSize:16,lineHeight:1,flexShrink:0,marginTop:1}}>{typeMap[type]||"📋"}</span>
        <div style={{fontSize:14,fontWeight:700,color:"#f0eee8",lineHeight:1.35,flex:1}}>{item.title||"Без названия"}</div>
      </div>
      <div style={M.tags}>
        {proj.label&&<span style={{...M.tag,color:proj.color,borderColor:proj.color+"40",background:proj.color+"12"}}>{proj.label}</span>}
        <MStatusBadge status={item.status} statuses={ALL_STATUSES}/>
      </div>
      <div style={M.cfoot}>
        <div style={{...M.avs}}>
          {members.map((m,i)=><MAvatar key={m.id} member={m} size={24}/>)}
        </div>
        {dateStr&&<span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>📅 {dateStr}</span>}
      </div>
    </div>
  );
}

// ── Карточка публикации ───────────────────────────────────────────────────────
function MPubCard({item, projects, onOpen, onStar}){
  const st = PUB_STATUSES.find(s=>s.id===item.status)||{l:item.status,c:"#6b7280"};
  const proj = projects.find(p=>p.id===item.project)||{label:"",color:"#6b7280"};
  const pubTypeLabel = item.pub_type==="carousel"?"🖼 Карусель":item.pub_type==="video"?"🎬 Видео":"📝 Пост";
  const cnt = item.pub_type==="carousel"?1:Math.max(1,parseInt(item.reels_count)||1);

  return (
    <div style={{...M.card, borderLeft:`3px solid ${st.c}`}} onClick={()=>onOpen("pub",item)}>
      <div style={{display:"flex",alignItems:"flex-start",gap:6}}>
        <div style={{flex:1}}>
          <div style={M.cardTitle}>{item.title||"Без названия"}</div>
          <div style={M.tags}>
            {proj.label&&<span style={{...M.tag,color:proj.color,borderColor:proj.color+"40",background:proj.color+"12"}}>{proj.label}</span>}
            <MTag color={STATUS_COLOR_KEY(st.c)}>{st.l}</MTag>
            <span style={M.tag}>{pubTypeLabel}</span>
            {cnt>1&&<span style={{...M.tag,color:"#a78bfa",borderColor:"#8b5cf630",background:"#8b5cf612"}}>×{cnt}</span>}
          </div>
        </div>
        <span onClick={e=>{e.stopPropagation();onStar&&onStar(item);}} style={{color:item.starred?"#f59e0b":"#2d2d44",fontSize:22,cursor:"pointer",lineHeight:1,padding:4}}>★</span>
      </div>
      {item.planned_date&&<div style={{fontSize:10,color:"#4b5563",fontFamily:"monospace",marginTop:4}}>📅 {item.planned_date}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКРАН: ЗАДАЧИ
// ═══════════════════════════════════════════════════════════════════════════════
function MTasksScreen({preItems,prodItems,postReels,postVideo,postCarousels,pubItems,projects,team,onOpen,onAdd,currentUser}){
  const [filter,setFilter] = useState("all");
  const [search,setSearch] = useState("");
  const [myOnly,setMyOnly] = useState(false);

  const sections = [
    {id:"post_reels", label:"РИЛСЫ", color:"#ec4899", items:postReels},
    {id:"post_video", label:"ВИДЕО", color:"#3b82f6", items:postVideo},
    {id:"post_carousel", label:"КАРУСЕЛИ", color:"#a78bfa", items:postCarousels},
    {id:"pre", label:"СЦЕНАРИИ", color:"#8b5cf6", items:preItems},
    {id:"prod", label:"СЪЁМКИ", color:"#3b82f6", items:prodItems},
    {id:"pub", label:"ПУБЛИКАЦИИ", color:"#10b981", items:pubItems},
  ];

  const filterGroups = [
    {id:"all",l:"Все"},
    {id:"post",l:"Постпродакшн"},
    {id:"pre",l:"Препродакшн"},
    {id:"prod",l:"Съёмки"},
    {id:"pub",l:"Публикации"},
  ];

  const isInGroup = (id, g) => {
    if(g==="all") return true;
    if(g==="post") return ["post_reels","post_video","post_carousel"].includes(id);
    return id===g;
  };

  const myFields = ["producer","editor","scriptwriter","operator","designer","customer","executor"];
  const filterItem = item => {
    if(myOnly && currentUser && !myFields.some(f=>item[f]===currentUser.id)) return false;
    if(search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return !item.archived;
  };

  const visibleSections = sections
    .filter(s=>isInGroup(s.id,filter))
    .map(s=>({...s, items:s.items.filter(filterItem)}))
    .filter(s=>s.items.length>0);

  const total = sections.reduce((acc,s)=>acc+s.items.filter(x=>!x.archived).length,0);

  return <>
    {/* Шапка */}
    <div style={M.sh}>
      <div style={{...M.shRow,marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={M.title}>Задачи</div>
          <div style={M.sub}>{total} активных</div>
        </div>
        <button style={M.actionBtn} onClick={onAdd}>+ Создать</button>
      </div>
      {/* Поиск */}
      <div style={{position:"relative",marginBottom:10}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#4b5563"}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию..."
          style={{width:"100%",background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"9px 12px 9px 36px",color:"#f0eee8",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      </div>
      {/* Фильтры */}
      <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>
        {filterGroups.map(c=>(
          <button key={c.id} style={{...M.chip,...(filter===c.id?M.chipGreen:{})}} onClick={()=>setFilter(c.id)}>{c.l}</button>
        ))}
        <button style={{...M.chip,...(myOnly?{background:"#f59e0b18",borderColor:"#f59e0b55",color:"#f59e0b"}:{})}} onClick={()=>setMyOnly(p=>!p)}>Мои</button>
      </div>
    </div>

    {/* Список */}
    <div style={{...M.scroll,...M.pad}}>
      {visibleSections.map(s=>(
        <div key={s.id} style={{marginBottom:20}}>
          <div style={M.secH}>
            <span style={{...M.secT,color:s.color}}>{s.label}</span>
            <span style={{fontSize:11,color:"#374151",fontFamily:"monospace",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"2px 8px"}}>{s.items.length}</span>
          </div>
          {s.items.map(item=>(
            <MTaskCard key={item.id} item={item} type={s.id} projects={projects} team={team} onOpen={onOpen}/>
          ))}
        </div>
      ))}
      {visibleSections.length===0&&(
        <div style={{textAlign:"center",color:"#374151",fontSize:13,padding:"60px 0"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔍</div>
          <div>Задач не найдено</div>
        </div>
      )}
    </div>
  </>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКРАН: ПУБЛИКАЦИИ
// ═══════════════════════════════════════════════════════════════════════════════
function MPubScreen({pubItems,projects,team,onOpen,onAdd,onStar}){
  const [view,setView] = useState("week");
  const [weekBase,setWeekBase] = useState(()=>{
    const d=new Date(); const dow=d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); d.setHours(0,0,0,0); return d;
  });
  const active = pubItems.filter(x=>!x.archived);

  // Неделя
  const fmtDate = d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const days = Array.from({length:7},(_,i)=>{const d=new Date(weekBase);d.setDate(d.getDate()+i);return d;});
  const byDay = {};
  active.forEach(x=>{if(x.planned_date){const k=x.planned_date.slice(0,10);(byDay[k]=byDay[k]||[]).push(x);}});
  const todayStr = fmtDate(new Date());
  const WDAYS_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

  // По статусам
  const byStatus = PUB_STATUSES.map(st=>({...st, items:active.filter(x=>x.status===st.id)})).filter(s=>s.items.length>0);

  return <>
    <div style={M.sh}>
      <div style={{...M.shRow,marginBottom:10}}>
        <div style={{flex:1}}><div style={M.title}>Публикации</div></div>
        <button style={M.actionBtn} onClick={onAdd}>+ Добавить</button>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"}}>
        {[{id:"week",l:"📅 Неделя"},{id:"status",l:"📋 По статусам"},{id:"list",l:"📄 Список"}].map(v=>(
          <button key={v.id} style={{...M.chip,...(view===v.id?M.chipGreen:{})}} onClick={()=>setView(v.id)}>{v.l}</button>
        ))}
      </div>
    </div>

    <div style={{...M.scroll,...(view!=="week"?M.pad:{})}}>

      {/* ── НЕДЕЛЯ ── */}
      {view==="week"&&<>
        {/* Навигация */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px 8px",background:"#0d0d14",position:"sticky",top:0,zIndex:2,borderBottom:"1px solid #111118"}}>
          <button onClick={()=>{const d=new Date(weekBase);d.setDate(d.getDate()-7);setWeekBase(d);}} style={{width:32,height:32,borderRadius:10,background:"#111118",border:"1px solid #1e1e2e",color:"#9ca3af",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <div style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700,fontFamily:"monospace"}}>
            {days[0].getDate()} {MONTHS[days[0].getMonth()]} — {days[6].getDate()} {MONTHS[days[6].getMonth()]}
          </div>
          <button onClick={()=>{const d=new Date(weekBase);d.setDate(d.getDate()+7);setWeekBase(d);}} style={{width:32,height:32,borderRadius:10,background:"#111118",border:"1px solid #1e1e2e",color:"#9ca3af",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
        {/* Дни */}
        <div style={{padding:"0 12px 16px"}}>
          {days.map((d,i)=>{
            const k=fmtDate(d);
            const its=byDay[k]||[];
            const isToday=k===todayStr;
            const mm=String(d.getMonth()+1).padStart(2,"0");
            const dd=String(d.getDate()).padStart(2,"0");
            const holiday=RU_HOLIDAYS[`${mm}-${dd}`];
            return (
              <div key={k} style={{marginTop:i===0?12:0}}>
                {/* Заголовок дня */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,marginTop:i===0?0:14}}>
                  <div style={{width:38,height:38,borderRadius:12,background:isToday?"#7c3aed":"#111118",border:`1px solid ${isToday?"#7c3aed":"#1e1e2e"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:8,color:isToday?"#c4b5fd":"#4b5563",fontFamily:"monospace",fontWeight:700}}>{WDAYS_SHORT[i]}</span>
                    <span style={{fontSize:15,fontWeight:800,color:isToday?"#fff":"#f0eee8",lineHeight:1}}>{d.getDate()}</span>
                  </div>
                  <div style={{flex:1}}>
                    {holiday&&<div style={{fontSize:9,color:"#f59e0b",fontFamily:"monospace"}}>{holiday}</div>}
                    {its.length===0&&<div style={{fontSize:11,color:"#2d2d44",fontFamily:"monospace"}}>Нет публикаций</div>}
                  </div>
                  {its.length>0&&<span style={{fontSize:10,fontFamily:"monospace",color:"#10b981",background:"#10b98118",borderRadius:8,padding:"2px 8px"}}>{its.length} публ.</span>}
                </div>
                {/* Карточки дня */}
                {its.map(item=><MPubCard key={item.id} item={item} projects={projects} onOpen={onOpen} onStar={onStar}/>)}
              </div>
            );
          })}
        </div>
      </>}

      {/* ── ПО СТАТУСАМ ── */}
      {view==="status"&&<>
        {byStatus.map(s=>(
          <div key={s.id} style={{marginBottom:20}}>
            <div style={M.secH}>
              <span style={{...M.secT,color:s.c}}>{s.l.toUpperCase()}</span>
              <span style={{fontSize:11,color:"#374151",fontFamily:"monospace",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"2px 8px"}}>{s.items.length}</span>
            </div>
            {s.items.map(item=><MPubCard key={item.id} item={item} projects={projects} onOpen={onOpen} onStar={onStar}/>)}
          </div>
        ))}
        {byStatus.length===0&&<div style={{textAlign:"center",color:"#374151",fontSize:13,padding:"60px 0"}}><div style={{fontSize:40,marginBottom:12}}>📭</div>Нет публикаций</div>}
      </>}

      {/* ── СПИСОК ── */}
      {view==="list"&&<>
        {active.length===0&&<div style={{textAlign:"center",color:"#374151",fontSize:13,padding:"60px 0"}}><div style={{fontSize:40,marginBottom:12}}>📭</div>Нет публикаций</div>}
        {active.sort((a,b)=>(a.planned_date||"").localeCompare(b.planned_date||"")).map(item=>(
          <MPubCard key={item.id} item={item} projects={projects} onOpen={onOpen} onStar={onStar}/>
        ))}
      </>}
    </div>
  </>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКРАН: АНАЛИТИКА (рилсы)
// ═══════════════════════════════════════════════════════════════════════════════
function MAnalyticsScreen({pubItems,projects}){
  const [stats,setStats]=useState({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const ids=pubItems.filter(x=>x.status==="published").map(x=>x.id);
    if(!ids.length){setLoading(false);return;}
    fetch("/api/reel-stats/latest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task_ids:ids})})
      .then(r=>r.json()).then(d=>{setStats(d);setLoading(false);}).catch(()=>setLoading(false));
  },[pubItems]);

  function fmt(n){
    if(!n&&n!==0) return "—";
    if(n>=1000000) return (n/1000000).toFixed(1)+"M";
    if(n>=1000) return (n/1000).toFixed(1)+"K";
    return String(n);
  }

  const published = pubItems.filter(x=>x.status==="published");
  const totalViews = published.reduce((s,x)=>s+(parseInt(stats[x.id]?.views)||0),0);
  const totalLikes = published.reduce((s,x)=>s+(parseInt(stats[x.id]?.likes)||0),0);
  const totalComments = published.reduce((s,x)=>s+(parseInt(stats[x.id]?.comments)||0),0);

  const top = published
    .map(x=>({...x,views:parseInt(stats[x.id]?.views)||0,likes:parseInt(stats[x.id]?.likes)||0,comments:parseInt(stats[x.id]?.comments)||0}))
    .filter(x=>x.views>0)
    .sort((a,b)=>b.views-a.views)
    .slice(0,10);

  const StatCard = ({icon,label,value,color})=>(
    <div style={{flex:1,background:"#111118",border:"1px solid #1a1a2e",borderRadius:16,padding:"14px 16px",minWidth:0}}>
      <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginBottom:6}}>{icon} {label}</div>
      <div style={{fontSize:22,fontWeight:800,color,fontFamily:"monospace",letterSpacing:-0.5}}>{fmt(value)}</div>
    </div>
  );

  return <>
    <div style={M.sh}>
      <div style={M.title}>Аналитика</div>
      <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginTop:4}}>{published.reduce((s,x)=>s+pubCount(x),0)} опубликовано · обновление в 07:00</div>
    </div>
    <div style={{...M.scroll,...M.pad}}>
      {loading&&<div style={{textAlign:"center",padding:"40px 0",color:"#4b5563",fontSize:13}}>⏳ Загрузка статистики...</div>}
      {!loading&&<>
        {/* KPI карточки */}
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <StatCard icon="👁" label="ПРОСМОТРЫ" value={totalViews} color="#06b6d4"/>
          <StatCard icon="❤️" label="ЛАЙКИ" value={totalLikes} color="#ec4899"/>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:20}}>
          <StatCard icon="💬" label="КОММ." value={totalComments} color="#8b5cf6"/>
          <StatCard icon="📹" label="ПУБЛИКАЦИЙ" value={pub.reduce((s,x)=>s+pubCount(x),0)} color="#10b981"/>
        </div>

        {/* ERR */}
        {totalViews>0&&totalLikes>0&&(
          <div style={{background:"#111118",border:"1px solid #1a1a2e",borderRadius:16,padding:"14px 16px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>📈 ERR (лайки/просм.)</span>
            <span style={{fontSize:20,fontWeight:800,color:"#f59e0b",fontFamily:"monospace"}}>{(totalLikes/totalViews*100).toFixed(2)}%</span>
          </div>
        )}

        {/* Топ рилсов */}
        {top.length>0&&<>
          <div style={{...M.secH,marginBottom:14}}>
            <span style={M.secT}>🏆 ТОП РИЛСОВ</span>
          </div>
          {top.map((item,i)=>{
            const proj=projects.find(p=>p.id===item.project);
            return (
              <div key={item.id} style={{...M.card,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:10,background:i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#cd7f32":"#1a1a2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?16:12,fontWeight:800,color:i<3?"#0d0d14":"#4b5563",flexShrink:0}}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f0eee8",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</div>
                    {proj&&<span style={{fontSize:9,color:proj.color,background:proj.color+"18",borderRadius:6,padding:"2px 7px",fontFamily:"monospace"}}>{proj.label}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:12,marginTop:10,paddingTop:10,borderTop:"1px solid #1a1a2e"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#06b6d4",fontFamily:"monospace"}}>{fmt(item.views)}</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>просмотры</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#ec4899",fontFamily:"monospace"}}>{fmt(item.likes)}</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>лайки</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#8b5cf6",fontFamily:"monospace"}}>{fmt(item.comments)}</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>комм.</div>
                  </div>
                  {item.views>0&&item.likes>0&&<div style={{textAlign:"center",marginLeft:"auto"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#f59e0b",fontFamily:"monospace"}}>{(item.likes/item.views*100).toFixed(1)}%</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>ERR</div>
                  </div>}
                </div>
              </div>
            );
          })}
        </>}

        {top.length===0&&!loading&&(
          <div style={{textAlign:"center",color:"#374151",fontSize:13,padding:"40px 0"}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <div>Нет данных по просмотрам</div>
            <div style={{fontSize:11,color:"#2d2d44",marginTop:8}}>Добавьте ссылку на рилс в карточку публикации</div>
          </div>
        )}
      </>}
    </div>
  </>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКРАН: СВОДКА
// ═══════════════════════════════════════════════════════════════════════════════
function MSummaryScreen({preItems,prodItems,postReels,postVideo,postCarousels,pubItems,projects,team,currentUser,onOpen}){
  const [member,setMember]=useState(currentUser?.id||"all");

  const allItems=[
    ...preItems.map(x=>({...x,_type:"pre"})),
    ...prodItems.map(x=>({...x,_type:"prod"})),
    ...postReels.map(x=>({...x,_type:"post_reels"})),
    ...postVideo.map(x=>({...x,_type:"post_video"})),
    ...postCarousels.map(x=>({...x,_type:"post_carousel"})),
  ].filter(x=>!x.archived);

  const execFields=["editor","scriptwriter","operator","designer","executor"];
  const custFields=["producer","customer"];
  const allFields=[...execFields,...custFields];

  const filtered=member==="all"?allItems:allItems.filter(x=>allFields.some(f=>x[f]===member));
  const asExec=filtered.filter(x=>execFields.some(f=>x[f]===(member==="all"?x[f]:member)&&x[f]));
  const asCust=filtered.filter(x=>custFields.some(f=>x[f]===(member==="all"?x[f]:member)&&x[f]));

  const typeColor={pre:"#8b5cf6",prod:"#3b82f6",post_reels:"#ec4899",post_video:"#3b82f6",post_carousel:"#a78bfa"};
  const ALL_STATUSES=[...PRE_STATUSES,...PROD_STATUSES,...POST_STATUSES];

  const MiniCard=({item})=>{
    const proj=projects.find(p=>p.id===item.project)||{label:"",color:"#6b7280"};
    const st=ALL_STATUSES.find(s=>s.id===item.status)||{l:item.status,c:"#6b7280"};
    const c=typeColor[item._type]||"#6b7280";
    return (
      <div onClick={()=>onOpen(item._type,item)} style={{background:"#111118",border:"1px solid #1a1a2e",borderRadius:12,padding:"10px 12px",marginBottom:8,borderLeft:`3px solid ${c}`,cursor:"pointer"}}>
        <div style={{fontSize:13,fontWeight:700,color:"#f0eee8",marginBottom:5,lineHeight:1.3}}>{item.title||"Без названия"}</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {proj.label&&<span style={{...M.tag,fontSize:9,color:proj.color,borderColor:proj.color+"40",background:proj.color+"12"}}>{proj.label}</span>}
          <MTag color={STATUS_COLOR_KEY(st.c)}>{st.l}</MTag>
        </div>
      </div>
    );
  };

  return <>
    <div style={M.sh}>
      <div style={{...M.shRow,marginBottom:10}}>
        <div style={M.title}>Сводка</div>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>
        <button style={{...M.chip,...(member==="all"?M.chipGreen:{})}} onClick={()=>setMember("all")}>Все</button>
        {team.map(m=>(
          <button key={m.id} style={{...M.chip,...(member===m.id?{...M.chipOn,borderColor:m.color+"50",color:m.color,background:m.color+"15"}:{})}} onClick={()=>setMember(m.id)}>
            {m.name?.split(" ")[0]||m.telegram}
          </button>
        ))}
      </div>
    </div>
    <div style={{...M.scroll,...M.pad}}>
      {/* Исполнитель */}
      <div style={{...M.secH,marginBottom:12}}>
        <span style={M.secT}>КАК ИСПОЛНИТЕЛЬ</span>
        <span style={{fontSize:11,color:"#374151",fontFamily:"monospace",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"2px 8px"}}>{asExec.length}</span>
      </div>
      {asExec.length>0?asExec.map(item=><MiniCard key={item.id} item={item}/>):<div style={{fontSize:12,color:"#374151",marginBottom:20,padding:"10px 0"}}>Нет задач</div>}

      {/* Заказчик */}
      <div style={{...M.secH,marginBottom:12,marginTop:8}}>
        <span style={M.secT}>КАК ЗАКАЗЧИК</span>
        <span style={{fontSize:11,color:"#374151",fontFamily:"monospace",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"2px 8px"}}>{asCust.length}</span>
      </div>
      {asCust.length>0?asCust.map(item=><MiniCard key={item.id} item={item}/>):<div style={{fontSize:12,color:"#374151",padding:"10px 0"}}>Нет задач</div>}
    </div>
  </>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ЭКРАН: БАЗА
// ═══════════════════════════════════════════════════════════════════════════════
function MBaseScreen({projects,setProjects,teamMembers,setTeamMembers,currentUser}){
  const [sub,setSub]=useState("team");

  return <>
    <div style={M.sh}>
      <div style={{...M.shRow,marginBottom:10}}><div style={M.title}>База</div></div>
      <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"}}>
        {[{id:"team",l:"👥 Команда"},{id:"projects",l:"📁 Проекты"},{id:"training",l:"📚 Обучение"}].map(t=>(
          <button key={t.id} style={{...M.chip,...(sub===t.id?M.chipGreen:{})}} onClick={()=>setSub(t.id)}>{t.l}</button>
        ))}
      </div>
    </div>
    <div style={{...M.scroll,...M.pad}}>

      {sub==="team"&&teamMembers.map(m=>(
        <div key={m.id} style={{...M.card,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:52,height:52,borderRadius:16,background:`linear-gradient(135deg,${m.color||"#6b7280"},${m.color||"#6b7280"}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",flexShrink:0}}>
              {(m.name||"?")[0].toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:"#f0eee8"}}>{m.name}</div>
              <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginTop:3}}>{m.role}</div>
              {m.telegram&&<div style={{fontSize:11,color:"#3b82f6",marginTop:3}}>@{m.telegram}</div>}
            </div>
            {m.id===currentUser?.id&&<span style={{fontSize:9,background:"#8b5cf620",color:"#a78bfa",border:"1px solid #8b5cf640",borderRadius:8,padding:"3px 8px",fontFamily:"monospace",fontWeight:700}}>Вы</span>}
          </div>
        </div>
      ))}

      {sub==="projects"&&projects.filter(p=>!p.archived).map(proj=>(
        <div key={proj.id} style={{...M.card,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:14,background:proj.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#fff",flexShrink:0}}>
              {(proj.label||"?")[0]}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:"#f0eee8"}}>{proj.label}</div>
            </div>
          </div>
          {proj.description&&<div style={{fontSize:12,color:"#4b5563",lineHeight:1.5}}>{proj.description}</div>}
          {proj.links?.length>0&&<div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
            {proj.links.map((l,i)=>(
              <a key={i} href={l.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:"#3b82f6",background:"#3b82f618",border:"1px solid #3b82f630",borderRadius:8,padding:"3px 10px",textDecoration:"none",fontFamily:"monospace"}}>{l.label||"🔗 Ссылка"}</a>
            ))}
          </div>}
        </div>
      ))}

      {sub==="training"&&<TrainingView/>}
    </div>
  </>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// МОБИЛЬНОЕ ПРИЛОЖЕНИЕ
// ═══════════════════════════════════════════════════════════════════════════════
function MobileApp({currentUser,onLogout,stores}){
  const {preItems,prodItems,postReels,postVideo,postCarousels,pubItems,projects,teamMembers:team,modal,openEdit,openNew,close,save,deleteTask,setPubItems,sendToPub} = stores;
  const [tab,setTab]=useState("tasks");
  const [notifOpen,setNotifOpen]=useState(false);
  const [notifs,setNotifs]=useState([]);
  const saveFnRef=useRef(null);

  useEffect(()=>{
    let cancelled=false;
    function poll(){
      if(cancelled) return;
      fetch("/api/notifications",{headers:{"x-user-id":currentUser.id}})
        .then(r=>r.ok?r.json():[]).then(data=>{if(!cancelled)setNotifs(data);}).catch(()=>{});
    }
    poll(); const iv=setInterval(poll,15000); return()=>{cancelled=true;clearInterval(iv);};
  },[currentUser.id]);

  const unread=notifs.filter(n=>!n.read).length;
  const activeTotal=[...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...pubItems].filter(x=>!x.archived).length;

  function markAllRead(){
    fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({})})
      .then(()=>setNotifs([])).catch(()=>{});
  }

  const tabs=[
    {id:"tasks",  icon:"📋", label:"Задачи",   badge:activeTotal>0?activeTotal:null},
    {id:"pub",    icon:"🚀", label:"Публикации",badge:null},
    {id:"analytics",icon:"📊",label:"Рилсы",  badge:null},
    {id:"summary",icon:"⚡", label:"Сводка",   badge:null},
    {id:"base",   icon:"🗂", label:"База",      badge:null},
  ];

  // toggle star для публикаций
  function toggleStar(item){
    const starred=!item.starred;
    stores.setPubItems?.(prev=>prev.map(x=>x.id===item.id?{...x,starred}:x));
    fetch(`/api/tasks/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({data:{starred}})}).catch(()=>{});
  }

  return (
    <div style={{height:"100vh",height:"100dvh",background:"#0d0d14",color:"#f0eee8",display:"flex",flexDirection:"column",fontFamily:"'Inter',sans-serif",overflow:"hidden",position:"relative"}}>

      {/* TOP BAR */}
      <div style={{background:"#0d0d14",borderBottom:"1px solid #111118",padding:"env(safe-area-inset-top, 10px) 16px 10px",paddingTop:`max(env(safe-area-inset-top, 10px), 10px)`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#7c3aed,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🍇</div>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,letterSpacing:-0.3}}>Виноград</div>
        </div>
        {/* Уведомления */}
        <button onClick={()=>setNotifOpen(p=>!p)} style={{position:"relative",background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18}}>
          🔔
          {unread>0&&<span style={{position:"absolute",top:4,right:4,width:8,height:8,borderRadius:"50%",background:"#ef4444",border:"2px solid #0d0d14"}}/>}
        </button>
        {/* Аватар / выход */}
        <div onClick={onLogout} style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${currentUser.color||"#6b7280"},${currentUser.color||"#6b7280"}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff",cursor:"pointer",flexShrink:0}}>
          {(currentUser.name||"?")[0].toUpperCase()}
        </div>
      </div>

      {/* SCREENS */}
      <div style={{flex:1,overflow:"hidden",position:"relative"}}>
        {tab==="tasks"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MTasksScreen preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} projects={projects} team={team} onOpen={openEdit} onAdd={()=>openNew("post_reels")} currentUser={currentUser}/>
        </div>}
        {tab==="pub"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MPubScreen pubItems={pubItems} projects={projects} team={team} onOpen={openEdit} onAdd={()=>openNew("pub")} onStar={toggleStar}/>
        </div>}
        {tab==="analytics"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MAnalyticsScreen pubItems={pubItems} projects={projects}/>
        </div>}
        {tab==="summary"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MSummaryScreen preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} projects={projects} team={team} currentUser={currentUser} onOpen={openEdit}/>
        </div>}
        {tab==="base"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MBaseScreen projects={projects} setProjects={stores.setProjects} teamMembers={team} setTeamMembers={stores.setTeam} currentUser={currentUser}/>
        </div>}
      </div>

      {/* BOTTOM NAV */}
      <div style={{background:"#0a0a0f",borderTop:"1px solid #111118",display:"flex",alignItems:"stretch",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 4px 10px",cursor:"pointer",background:"transparent",border:"none",position:"relative",transition:"background 0.15s",borderTop:tab===t.id?"2px solid #8b5cf6":"2px solid transparent"}}>
            <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:9,fontFamily:"monospace",fontWeight:700,color:tab===t.id?"#a78bfa":"#374151",letterSpacing:"0.03em"}}>{t.label}</span>
            {t.badge&&<span style={{position:"absolute",top:6,right:"calc(50% - 12px)",background:"#ef4444",color:"#fff",fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:8,fontFamily:"monospace",minWidth:16,textAlign:"center"}}>{t.badge>99?"99+":t.badge}</span>}
          </button>
        ))}
      </div>

      {/* УВЕДОМЛЕНИЯ */}
      {notifOpen&&<>
        <div onClick={()=>setNotifOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",zIndex:40}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#111118",borderRadius:"24px 24px 0 0",borderTop:"1px solid #1e1e2e",zIndex:41,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"12px 20px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:36,height:4,background:"#2d2d44",borderRadius:2,margin:"0 auto 0",position:"absolute",left:"50%",transform:"translateX(-50%)",top:8}}/>
            <div style={{fontSize:16,fontWeight:800,flex:1}}>🔔 Уведомления</div>
            {notifs.length>0&&<button onClick={markAllRead} style={{fontSize:10,color:"#4b5563",background:"transparent",border:"1px solid #1e1e2e",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>Прочитать все</button>}
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"8px 16px 20px"}}>
            {notifs.length===0&&<div style={{color:"#4b5563",fontSize:13,textAlign:"center",padding:"30px 0"}}>Нет уведомлений</div>}
            {notifs.map(n=>(
              <div key={n.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid #1a1a2e",alignItems:"flex-start"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:n.read?"#1e1e2e":"#8b5cf6",marginTop:5,flexShrink:0,boxShadow:n.read?"none":"0 0 6px #8b5cf6"}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#f0eee8",lineHeight:1.35}}>{n.title}</div>
                  {n.body&&<div style={{fontSize:11,color:"#4b5563",marginTop:3,lineHeight:1.4}}>{n.body}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* МОДАЛКИ */}
      {modal?.type==="pre"           &&<Modal title="Препродакшн — Сценарий"  color="#8b5cf6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pre",modal.item.id):undefined}><PreForm           item={modal.item} onSave={d=>save("pre",d)}            onDelete={id=>deleteTask("pre",id)}           onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
      {modal?.type==="prod"          &&<Modal title="Продакшн — Съёмка"       color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("prod",modal.item.id):undefined}><ProdForm          item={modal.item} onSave={d=>save("prod",d)}           onDelete={id=>deleteTask("prod",id)}          onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
      {modal?.type==="post_reels"    &&<Modal title="Постпродакшн — Рилс"     color="#ec4899" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_reels",modal.item.id):undefined}><PostReelsForm     item={modal.item} onSave={d=>save("post_reels",d)}     onDelete={id=>deleteTask("post_reels",id)}    onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_reels",d)}/></Modal>}
      {modal?.type==="post_video"    &&<Modal title="Постпродакшн — Видео"    color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_video",modal.item.id):undefined}><PostVideoForm     item={modal.item} onSave={d=>save("post_video",d)}     onDelete={id=>deleteTask("post_video",id)}    onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_video",d)}/></Modal>}
      {modal?.type==="post_carousel" &&<Modal title="Постпродакшн — Карусель" color="#a78bfa" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_carousel",modal.item.id):undefined}><PostCarouselForm  item={modal.item} onSave={d=>save("post_carousel",d)}  onDelete={id=>deleteTask("post_carousel",id)} onClose={close} projects={projects} team={team} currentUser={currentUser} onSendToPub={d=>sendToPub("post_carousel",d)}/></Modal>}
      {modal?.type==="admin"         &&<Modal title="Административная задача"  color="#f97316" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("admin",modal.item.id):undefined}><AdminForm          item={modal.item} onSave={d=>save("admin",d)}           onDelete={id=>deleteTask("admin",id)}         onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
      {modal?.type==="pub"           &&<Modal title="Публикация"               color="#10b981" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pub",modal.item.id):undefined}><PubForm           item={modal.item} onSave={d=>save("pub",d)}            onDelete={id=>deleteTask("pub",id)}           onClose={close} saveFnRef={saveFnRef} projects={projects} team={team} currentUser={currentUser}/></Modal>}
    </div>
  );
}
