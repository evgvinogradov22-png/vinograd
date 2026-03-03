import { useState, useRef, useEffect } from "react";
import { api, createWS } from "./api";

const APP_NAME = "Виноград";

const TABS = [
  { id:"pre",      label:"Препродакшн",  icon:"✍️",  color:"#8b5cf6" },
  { id:"prod",     label:"Продакшн",      icon:"🎬",  color:"#3b82f6" },
  { id:"post",     label:"Постпродакшн",  icon:"🎞️", color:"#ec4899" },
  { id:"pub",      label:"Публикация",    icon:"🚀",  color:"#10b981" },
  { id:"summary",  label:"Сводка",        icon:"📊",  color:"#f97316" },
  { id:"projects", label:"Проекты",       icon:"📁",  color:"#f59e0b" },
  { id:"team",     label:"Команда",       icon:"👥",  color:"#06b6d4" },
];

const PRE_STATUSES  = [{id:"idea",l:"Идея",c:"#6b7280"},{id:"brief",l:"Бриф",c:"#f59e0b"},{id:"script",l:"Сценарий",c:"#8b5cf6"},{id:"approved",l:"Утверждено",c:"#10b981"}];
const PROD_STATUSES = [{id:"planned",l:"Запланировано",c:"#6b7280"},{id:"ready",l:"Готово к съёмке",c:"#f59e0b"},{id:"shooting",l:"Идёт съёмка",c:"#3b82f6"},{id:"done",l:"Снято",c:"#10b981"}];
const POST_STATUSES = [{id:"not_started",l:"Не начат",c:"#4b5563"},{id:"in_progress",l:"В монтаже",c:"#f59e0b"},{id:"review",l:"На проверке",c:"#8b5cf6"},{id:"done",l:"Готово",c:"#10b981"}];
const PUB_STATUSES  = [{id:"draft",l:"Черновик",c:"#6b7280"},{id:"ready",l:"Готово",c:"#f59e0b"},{id:"scheduled",l:"Запланировано",c:"#3b82f6"},{id:"published",l:"Опубликовано",c:"#10b981"}];
const ROLES_LIST    = ["Директор","Менеджер проекта","Сценарист","Оператор","Монтажёр","Продюсер","Таргетолог","Дизайнер","Другое"];
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const WDAYS  = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const AVATAR_COLORS = ["#ef4444","#3b82f6","#ec4899","#10b981","#f59e0b","#8b5cf6","#06b6d4","#f97316"];


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
  const bottomRef = useRef(null);
  const fileRef   = useRef(null);
  const inputRef  = useRef(null);
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
      setMsgs(p => [...p, { id: m.id||genId(), user: m.user_id||myId, text: m.text||t, ts: m.created_at||Date.now(), fname: "", furl: "" }]);
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
                  {m.furl && (
                    <div style={{display:"flex",alignItems:"center",gap:7,marginTop:m.text?5:0,background:"#ffffff0a",borderRadius:6,padding:"5px 9px"}}>
                      <span style={{fontSize:14}}>{fileIcon}</span>
                      <span style={{fontSize:11,color:"#d1d5db",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.fname||"файл"}</span>
                      <a href={m.furl} target="_blank" rel="noreferrer"
                        style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:5,textDecoration:"none"}}>
                        ↓
                      </a>
                    </div>
                  )}
                </div>
                <div style={{fontSize:7,color:"#6b7280",marginTop:2,textAlign:isMe?"right":"left"}}>{m.ts?new Date(m.ts).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}):""}</div>
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
        <button onClick={()=>{ if(!uploading) fileRef.current?.click(); }} title="Прикрепить файл" disabled={uploading}
          style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 9px",color:uploading?"#4b5563":"#9ca3af",cursor:uploading?"not-allowed":"pointer",fontSize:14,flexShrink:0}}>📎</button>
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
          style={{minWidth:235,width:235,background:overSt===st.id?"#111120":"#0d0d16",border:`1px solid ${overSt===st.id?st.c+"70":"#1e1e2e"}`,borderRadius:12,padding:"10px 8px",flexShrink:0,transition:"all 0.12s"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"0 2px"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:st.c}}/>
            <span style={{fontSize:10,fontWeight:700,color:st.c,fontFamily:"monospace"}}>{st.l}</span>
            <span style={{fontSize:9,background:st.c+"20",color:st.c,borderRadius:10,padding:"0 6px",marginLeft:"auto",fontFamily:"monospace"}}>{col.length}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {col.map(item=>(
              <div key={item.id} draggable onDragStart={()=>setDragId(item.id)} style={{cursor:"grab",userSelect:"none"}}>{renderCard(item)}</div>
            ))}
            <button onClick={()=>onAddClick(st.id)} style={{background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"7px",color:"#6b7280",cursor:"pointer",fontSize:11,width:"100%"}}>+ Добавить</button>
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
function WeekView({items,onItemClick,onDayClick,projects,onMoveToDay}){
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
        {days.map(d=>{
          const k=fmt(d); const its=byDay[k]||[]; const isToday=k===todayStr; const isOver=overDay===k;
          return <div key={k}
            onDragOver={e=>{e.preventDefault();setOverDay(k);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverDay(null);}}
            onDrop={e=>{e.preventDefault();if(dragId){onMoveToDay(dragId,k+"T12:00");setDragId(null);setOverDay(null);}}}
            onClick={()=>onDayClick(k+"T12:00")}
            style={{background:isOver?"#111130":isToday?"#0f0f1e":"#111118",border:isOver?"1px solid #7c3aed":isToday?"1px solid #7c3aed":"1px solid #1e1e2e",borderRadius:10,padding:"8px 7px",minHeight:130,cursor:"pointer",transition:"all 0.1s"}}
            onMouseEnter={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#3d3d5c";}}
            onMouseLeave={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#1e1e2e";}}>
            <div style={{textAlign:"center",marginBottom:6}}>
              <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace"}}>{WDAYS[days.indexOf(d)]}</div>
              <div style={{fontSize:15,fontWeight:800,color:isToday?"#a78bfa":"#f0eee8"}}>{d.getDate()}</div>
            </div>
            {its.map(x=>{const sc=stColor(PUB_STATUSES,x.status);return(
              <div key={x.id} draggable onDragStart={e=>{e.stopPropagation();setDragId(x.id);}}
                onClick={e=>{e.stopPropagation();onItemClick(x);}}
                style={{background:sc+"18",border:`1px solid ${sc}40`,borderRadius:5,padding:"3px 5px",marginBottom:3,fontSize:9,color:sc,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"grab"}}>{x.title}
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
  const u=(k,v)=>setD(p=>({...p,[k]:v}));
  useEffect(()=>{ if(saveFnRef) saveFnRef.current=()=>onSave(d); },[d]);
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
  const u=(k,v)=>setD(p=>({...p,[k]:v}));
  useEffect(()=>{ if(saveFnRef) saveFnRef.current=()=>onSave(d); },[d]);
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
        setUploading(true); u("final_file_name",f.name); u("final_file_url","");
        try{
          const fd=new FormData(); fd.append("file",f);
          const r=await fetch("/api/upload",{method:"POST",body:fd});
          if(!r.ok) throw new Error(await r.text());
          const up=await r.json();
          const k=up.key||"";
          u("final_file_url", k?`/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(f.name)}`:up.url);
        }catch(e){alert("Ошибка: "+e.message);}
        setUploading(false); e.target.value="";
      }}/>
      {d.final_file_name
        ?<div style={{background:"#0a1a0a",border:"1px solid #10b98130",borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
              <span>🎬</span>
              <span style={{flex:1,fontSize:11,color:"#10b981",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.final_file_name}</span>
              {d.final_file_url
                ?<a href={d.final_file_url} target="_blank" rel="noreferrer" style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:5,textDecoration:"none"}}>↓ Скачать</a>
                :<span style={{fontSize:9,color:"#f59e0b"}}>⏳</span>}
              <button onClick={()=>{u("final_file_name","");u("final_file_url","");}} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:16}}>×</button>
            </div>
            {d.final_file_url&&/\.(mp4|mov|webm|avi|mkv)$/i.test(d.final_file_name)&&
              <video controls style={{width:"100%",maxHeight:320,display:"block",background:"#000"}} preload="metadata">
                <source src={d.final_file_url}/>
              </video>}
          </div>
        :<button onClick={()=>fRef.current?.click()} disabled={uploading} style={{width:"100%",background:"transparent",border:"1px dashed #2d2d44",borderRadius:8,padding:"12px",color:uploading?"#f59e0b":"#9ca3af",cursor:"pointer",fontSize:12}}>{uploading?"⏳ Загрузка...":"📤 Загрузить финальное видео"}</button>}
    </>}
  </div>;
}

// ── SourceInputs — upload files OR paste links ──────────────────────────────
function SourceInputs({d, u}){
  const [mode, setMode] = useState(d.source_url||d.source_name ? "file" : d.source_link ? "link" : "file");
  const [nl, setNl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef(null);
  const sources = d.sources || (d.source_name ? [{name:d.source_name, url:d.source_url||""}] : []);

  async function addFile(e) {
    const files = Array.from(e.target.files); e.target.value = "";
    if (!files.length) return;
    setUploading(true); setUploadErr("");
    for (const f of files) {
      try {
        const fd = new FormData(); fd.append("file", f);
        const r = await fetch("/api/upload", {method:"POST", body:fd});
        if (!r.ok) throw new Error(await r.text());
        const up = await r.json();
        const k = up.key||"";
        const dlurl = k ? `/api/download?key=${encodeURIComponent(k)}&name=${encodeURIComponent(f.name)}` : up.url;
        const newSources = [...sources, {name:f.name, url:dlurl}];
        u("sources", newSources);
        // Back-compat: set source_name/source_url to first file
        if (newSources.length === 1) { u("source_name", f.name); u("source_url", dlurl); }
      } catch(e) { setUploadErr(e.message); }
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
  const u=(k,v)=>setD(p=>({...p,[k]:v}));
  useEffect(()=>{ if(saveFnRef) saveFnRef.current=()=>onSave(d); },[d]);
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
  const fileRef=useRef(null); const u=(k,v)=>setD(p=>({...p,[k]:v}));
  useEffect(()=>{ if(saveFnRef) saveFnRef.current=()=>onSave(d); },[d]);
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
  const u=(k,v)=>setD(p=>({...p,[k]:v}));
  useEffect(()=>{ if(saveFnRef) saveFnRef.current=()=>onSave(d); },[d]);
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

// ── PmpPublishPanel ─────────────────────────────────────────────────────────
function PmpPublishPanel({d, u, projects}){
  const [open,        setOpen]        = useState(false);
  const [pmpProjects, setPmpProjects] = useState([]); // [{id,name}]
  const [channels,    setChannels]    = useState([]); // [{id,name,platform}]
  const [selChannels, setSelChannels] = useState([]); // selected channel ids
  const [loading,     setLoading]     = useState(false);
  const [status,      setStatus]      = useState(""); // status message
  const [error,       setError]       = useState("");

  // Find PMP project id from current Виноград project
  const vinProj = projects.find(p => p.id === d.project);
  const pmpProjId = d.pmp_project_id || vinProj?.pmp_project_id || "";

  // Load PMP projects on first open
  async function loadProjects(){
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/pmp/projects");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка");
      const list = data?.data || data?.items || data || [];
      setPmpProjects(Array.isArray(list) ? list : []);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  // Load channels for selected PMP project
  async function loadChannels(pid){
    if (!pid) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/pmp/channels?project_id=" + pid);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка");
      const list = data?.data || data?.items || data || [];
      setChannels(Array.isArray(list) ? list : []);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }

  // Toggle channel selection
  function toggleCh(id){
    setSelChannels(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  }

  // Full publish flow: upload file → create publication
  async function publish(){
    const pid = pmpProjId || d.pmp_project_id;
    if (!pid) { setError("Укажи PMP Project ID в настройках проекта или в поле ниже"); return; }
    if (!selChannels.length) { setError("Выбери хотя бы один канал"); return; }
    setLoading(true); setError(""); setStatus("");

    try {
      let file_ids = [];

      // Step 1: Upload file if we have one
      const fileUrl = d.file_url || d.final_file_url || "";
      if (fileUrl) {
        setStatus("📤 Загружаю файл в Post My Post...");
        const upR = await fetch("/api/pmp/upload", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ file_url: fileUrl, file_name: d.file_name||d.final_file_name||"media", pmp_project_id: pid }),
        });
        const upData = await upR.json();
        if (!upR.ok) throw new Error("Upload: " + upData.error);
        file_ids = [upData.file_id];
        setStatus("✅ Файл загружен (ID: " + upData.file_id + ")");
      }

      // Step 2: Create publication
      setStatus("🚀 Создаю публикацию...");
      const pubR = await fetch("/api/pmp/publish", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          pmp_project_id: Number(pid),
          channel_ids: selChannels,
          post_at: d.planned_date ? new Date(d.planned_date).toISOString() : null,
          text: d.caption || d.title || "",
          hashtags: d.hashtags || "",
          file_ids,
          pub_type: d.pub_type || "video",
        }),
      });
      const pubData = await pubR.json();
      if (!pubR.ok) throw new Error("Publish: " + pubData.error);

      setStatus("✅ Опубликовано! ID: " + (pubData.publication_id || "?"));
      u("pmp_published", true);
      u("pmp_publication_id", pubData.publication_id);
    } catch(e) {
      setError(e.message);
      setStatus("");
    }
    setLoading(false);
  }

  const PLATFORM_ICONS = { instagram:"📸", tiktok:"🎵", facebook:"📘", vk:"💙", youtube:"▶️", telegram:"✈️", twitter:"🐦", linkedin:"💼" };

  return (
    <div style={{background:"#0a0f1a",border:"1px solid #1e3a5f",borderRadius:10,overflow:"hidden"}}>
      <button onClick={()=>{ setOpen(p=>!p); if(!open&&!pmpProjects.length) loadProjects(); }}
        style={{width:"100%",background:"transparent",border:"none",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",color:"#f0eee8"}}>
        <span style={{fontSize:13}}>📡</span>
        <span style={{fontSize:11,fontWeight:700,color:"#38bdf8"}}>Post My Post</span>
        {d.pmp_published && <span style={{fontSize:9,background:"#10b98120",color:"#10b981",border:"1px solid #10b98140",borderRadius:10,padding:"1px 8px"}}>✅ опубликовано</span>}
        <span style={{marginLeft:"auto",color:"#4b5563",fontSize:12}}>{open?"▲":"▼"}</span>
      </button>

      {open && <div style={{padding:"12px 14px",borderTop:"1px solid #1e3a5f",display:"flex",flexDirection:"column",gap:10}}>

        {/* PMP Project ID override */}
        <Field label="PMP PROJECT ID (из URL проекта в postmypost.io)">
          <input value={pmpProjId} onChange={e=>u("pmp_project_id",e.target.value)}
            onBlur={e=>{ if(e.target.value) loadChannels(e.target.value); }}
            placeholder={pmpProjId||"123456"} style={{...SI,fontFamily:"monospace"}}/>
        </Field>

        {/* PMP Projects dropdown (optional — auto-fill project id) */}
        {pmpProjects.length>0 && <Field label="ИЛИ ВЫБЕРИ ПРОЕКТ ИЗ СПИСКА">
          <select onChange={e=>{ u("pmp_project_id",e.target.value); loadChannels(e.target.value); }} style={SI} value={pmpProjId||""}>
            <option value="">— выбрать —</option>
            {pmpProjects.map(p=><option key={p.id} value={p.id}>{p.name||p.title||p.id}</option>)}
          </select>
        </Field>}

        {/* Channel selector */}
        {channels.length>0 && <div>
          <span style={LB}>КАНАЛЫ (куда публиковать)</span>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:4}}>
            {channels.map(ch=>{
              const icon = PLATFORM_ICONS[ch.platform?.toLowerCase()] || "📲";
              const sel = selChannels.includes(ch.id);
              return <div key={ch.id} onClick={()=>toggleCh(ch.id)}
                style={{display:"flex",alignItems:"center",gap:8,background:sel?"#1e3a5f":"#111118",border:`1px solid ${sel?"#38bdf8":"#2d2d44"}`,borderRadius:7,padding:"7px 10px",cursor:"pointer"}}>
                <span>{icon}</span>
                <span style={{fontSize:11,color:sel?"#38bdf8":"#9ca3af",flex:1}}>{ch.name||ch.username||ch.id}</span>
                <span style={{fontSize:9,color:"#6b7280",fontFamily:"monospace"}}>{ch.platform}</span>
                <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${sel?"#38bdf8":"#4b5563"}`,background:sel?"#38bdf8":"transparent",flexShrink:0}}/>
              </div>;
            })}
          </div>
        </div>}

        {!channels.length && pmpProjId && !loading && (
          <button onClick={()=>loadChannels(pmpProjId)} style={{background:"transparent",border:"1px dashed #2d2d44",borderRadius:7,padding:"7px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>
            🔄 Загрузить каналы
          </button>
        )}

        {/* Status / Error */}
        {loading && <div style={{fontSize:11,color:"#38bdf8",fontFamily:"monospace"}}>⏳ {status||"Загрузка..."}</div>}
        {!loading && status && <div style={{fontSize:11,color:"#10b981",fontFamily:"monospace"}}>{status}</div>}
        {error && <div style={{fontSize:11,color:"#ef4444",background:"#1a0000",border:"1px solid #ef444430",borderRadius:6,padding:"6px 10px"}}>{error}</div>}

        {/* Publish button */}
        <button onClick={publish} disabled={loading||!selChannels.length}
          style={{background:loading||!selChannels.length?"#1a1a2e":"linear-gradient(135deg,#0ea5e9,#0284c7)",border:"none",borderRadius:8,padding:"10px",color:loading||!selChannels.length?"#4b5563":"#fff",cursor:loading||!selChannels.length?"not-allowed":"pointer",fontSize:12,fontWeight:700}}>
          {loading?"⏳ Публикую...":"🚀 Опубликовать в Post My Post"}
        </button>
      </div>}
    </div>
  );
}

function PubForm({item,onSave,onDelete,onClose,projects,team,currentUser,saveFnRef}){
  const [d,setD]=useState({...item}); const [aiCap,setAiCap]=useState(false);
  const fileRef=useRef(null); const u=(k,v)=>setD(p=>({...p,[k]:v}));
  useEffect(()=>{ if(saveFnRef) saveFnRef.current=()=>onSave(d); },[d]);
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
        <option value="photo">📸 Фото</option>
        <option value="story">📱 Сторис</option>
      </select></Field>
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
    <PmpPublishPanel d={d} u={u} projects={projects}/>
    <MiniChat taskId={d.id} team={team} currentUser={currentUser}/>
    
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

function SummaryView({preItems,prodItems,postReels,postVideo,postCarousels,pubItems,projects,team,currentUser,onOpenTask}){
  const ME = currentUser?.id || "";
  const [scope,setScope]=useState("all"); // "all"|"my_customer"|"my_executor"
  // scope aliases used in filter
  const [projFilter,setProjFilter]=useState("all");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const activeProjs=projects.filter(p=>!p.archived);
  const nm=id=>teamOf(id,team)?.name||"?";
  const rc=id=>teamOf(id,team)?.color||"#6b7280";

  // Period cutoff
  function inPeriod(item){
    if(!dateFrom&&!dateTo) return true;
    const dates=[item.deadline,item.shoot_date,item.planned_date,item.post_deadline].filter(Boolean);
    if(dates.length===0) return true;
    return dates.some(d=>{
      const t=new Date(d).getTime();
      const from=dateFrom?new Date(dateFrom).getTime():0;
      const to=dateTo?new Date(dateTo).getTime()+86400000:Infinity;
      return t>=from&&t<=to;
    });
  }
  // Member fields
  const MF=["producer","editor","scriptwriter","operator","designer"];
  function isMyTask(item){
    if(scope==="my_customer") return item.customer===ME||item.producer===ME;
    if(scope==="my_executor") return ["editor","scriptwriter","operator","designer","executor"].some(f=>item[f]===ME);
    return MF.some(f=>item[f]===ME);
  }

  // Apply all filters
  function applyAll(items){
    let r=items;
    if(projFilter!=="all") r=r.filter(x=>x.project===projFilter);
    if(scope!=="all") r=r.filter(isMyTask);
    r=r.filter(inPeriod);
    return r;
  }
  const fPre=applyAll(preItems);
  const fProd=applyAll(prodItems);
  const fReels=applyAll(postReels);
  const fVideo=applyAll(postVideo);
  const fCarousels=applyAll(postCarousels);
  const fPub=applyAll(pubItems);
  const all=[...fPre,...fProd,...fReels,...fVideo,...fCarousels,...fPub];
  const allChats=all.flatMap(x=>{ const type=x._type||(fPre.includes(x)?"pre":fProd.includes(x)?"prod":"pub"); return (x.chat||[]).map(m=>({...m,taskTitle:x.title,taskProject:x.project,taskType:type,taskItem:x})); });
  const statCards=[
    {label:"Сценариев",count:fPre.length,color:"#8b5cf6",icon:"✍️"},
    {label:"Съёмок",count:fProd.length,color:"#3b82f6",icon:"🎬"},
    {label:"Постпродакшн",count:fReels.length+fVideo.length+fCarousels.length,color:"#ec4899",icon:"🎞️"},
    {label:"К публикации",count:fPub.filter(x=>x.status!=="published").length,color:"#10b981",icon:"🚀"},
    {label:"Опубликовано",count:fPub.filter(x=>x.status==="published").length,color:"#34d399",icon:"✅"},
    {label:"Сообщений",count:allChats.length,color:"#f97316",icon:"💬"},
  ];
  // byProject removed per request
  const allRaw=[...fPre.map(x=>({...x,_type:"pre"})),...fProd.map(x=>({...x,_type:"prod"})),...fReels.map(x=>({...x,_type:"post_reels"})),...fVideo.map(x=>({...x,_type:"post_video"})),...fCarousels.map(x=>({...x,_type:"post_carousel"})),...fPub.map(x=>({...x,_type:"pub"}))];
  const recentChats=allChats.slice(-10).reverse();
  // Deadlines from filtered items
  const deadlines=[
    ...fPre.filter(x=>x.deadline).map(x=>({...x,_type:"Сценарий",_date:x.deadline})),
    ...fProd.filter(x=>x.shoot_date).map(x=>({...x,_type:"Съёмка",_date:x.shoot_date.slice(0,10)})),
    ...fPub.filter(x=>x.planned_date&&x.status!=="published").map(x=>({...x,_type:"Публикация",_date:x.planned_date.slice(0,10)})),
  ].sort((a,b)=>a._date>b._date?1:-1).slice(0,8);

  const scopeLabel = scope==="my_customer"?"📋 Я заказчик":scope==="my_executor"?"🔧 Я исполнитель":"🏢 Все задачи";
  const projLabel  = projFilter==="all" ? "Все проекты" : (activeProjs.find(p=>p.id===projFilter)?.label||"?");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* ── FILTER BAR ── */}
      <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",fontWeight:700,marginBottom:10,letterSpacing:"0.1em"}}>ФИЛЬТРЫ СВОДКИ</div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-end"}}>

          {/* Scope: my / all */}
          <div>
            <span style={{...LB,display:"block"}}>ОБЛАСТЬ</span>
            <div style={{display:"flex",gap:4}}>
              {[["all","🏢 Все"],["my_customer","📋 Я заказчик"],["my_executor","🔧 Я исполнитель"]].map(([id,l])=>(
                <button key={id} onClick={()=>setScope(id)} style={{padding:"6px 12px",borderRadius:7,cursor:"pointer",background:scope===id?"#f97316"+"20":"#111118",border:`1px solid ${scope===id?"#f97316":"#2d2d44"}`,color:scope===id?"#f97316":"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:scope===id?700:400,whiteSpace:"nowrap"}}>{l}</button>
              ))}
            </div>
          </div>

          {/* Project filter */}
          <div>
            <span style={{...LB,display:"block"}}>ПРОЕКТ</span>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              <button onClick={()=>setProjFilter("all")} style={{padding:"6px 12px",borderRadius:7,cursor:"pointer",background:projFilter==="all"?"#f59e0b20":"#111118",border:`1px solid ${projFilter==="all"?"#f59e0b":"#2d2d44"}`,color:projFilter==="all"?"#f59e0b":"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:projFilter==="all"?700:400}}>Все</button>
              {activeProjs.map(p=>(
                <button key={p.id} onClick={()=>setProjFilter(p.id)} style={{padding:"6px 12px",borderRadius:7,cursor:"pointer",background:projFilter===p.id?p.color+"20":"#111118",border:`1px solid ${projFilter===p.id?p.color:"#9ca3af"}`,color:projFilter===p.id?p.color:"#9ca3af",fontSize:11,fontFamily:"inherit",fontWeight:projFilter===p.id?700:400}}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Period filter */}
          <div>
            <span style={{...LB,display:"block"}}>ПЕРИОД</span>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 8px",color:dateFrom?"#06b6d4":"#6b7280",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
              <span style={{color:"#9ca3af",fontSize:11}}>—</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 8px",color:dateTo?"#06b6d4":"#6b7280",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
              {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 8px",color:"#9ca3af",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>✕</button>}
            </div>
          </div>
        </div>

        {/* Active filter summary */}
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e1e2e",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace"}}>ПОКАЗАНО:</span>
          <span style={{fontSize:10,background:"#f97316"+"20",color:"#f97316",borderRadius:20,padding:"2px 10px",fontFamily:"monospace"}}>{scopeLabel}</span>
          <span style={{fontSize:10,background:"#f59e0b"+"20",color:"#f59e0b",borderRadius:20,padding:"2px 10px",fontFamily:"monospace"}}>📁 {projLabel}</span>
          <span style={{fontSize:10,background:"#06b6d420",color:"#06b6d4",borderRadius:20,padding:"2px 10px",fontFamily:"monospace"}}>⏱ {dateFrom||dateTo?(dateFrom||"…")+" → "+(dateTo||"…"):"Всё время"}</span>
          <span style={{fontSize:10,background:"#2d2d44",color:"#9ca3af",borderRadius:20,padding:"2px 10px",fontFamily:"monospace"}}>{all.length} задач</span>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        {statCards.map((s,i)=>(
          <div key={i} style={{background:"#111118",border:`1px solid ${s.color}25`,borderTop:`3px solid ${s.color}`,borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:5}}>{s.icon}</div>
            <div style={{fontSize:30,fontWeight:800,color:s.color,fontFamily:"monospace",lineHeight:1}}>{s.count}</div>
            <div style={{fontSize:10,color:"#cbd5e1",marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM GRID ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>

        {/* Chats — unread @mentions of me */}
        <UnreadMentions allChats={allChats} projects={projects} team={team} me={ME} onOpenTask={onOpenTask}/>
      </div>

      {/* ── DEADLINES ── */}
      <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,padding:"14px"}}>
        <div style={{fontSize:10,fontWeight:700,color:"#06b6d4",fontFamily:"monospace",marginBottom:12}}>📅 БЛИЖАЙШИЕ ДЕДЛАЙНЫ</div>
        {deadlines.length===0&&<div style={{textAlign:"center",color:"#9ca3af",fontSize:11,padding:"16px 0"}}>Нет предстоящих дедлайнов</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
          {deadlines.map((x,i)=>{
            const proj=projOf(x.project,projects);
            const daysLeft=Math.ceil((new Date(x._date).getTime()-Date.now())/(86400000));
            const urgent=daysLeft<=3;
            return <div key={i} onClick={()=>onOpenTask&&onOpenTask(x._type==="Сценарий"?"pre":x._type==="Съёмка"?"prod":"pub",x)} style={{background:"#111118",border:`1px solid ${urgent?"#ef444440":proj.color+"25"}`,borderLeft:`3px solid ${urgent?"#ef4444":proj.color}`,borderRadius:8,padding:"9px 12px",display:"flex",gap:10,alignItems:"center",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#16161f"} onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
              <div style={{textAlign:"center",minWidth:38}}>
                <div style={{fontSize:16,fontWeight:800,color:urgent?"#ef4444":"#f59e0b",fontFamily:"monospace",lineHeight:1}}>{daysLeft>0?daysLeft:"—"}</div>
                <div style={{fontSize:7,color:"#9ca3af",fontFamily:"monospace"}}>{daysLeft>0?"дн.":"сегодня"}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.title}</div>
                <div style={{fontSize:9,color:"#9ca3af",marginTop:1}}>{x._type} · <span style={{color:proj.color}}>{proj.label}</span></div>
                <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace"}}>{x._date}</div>
              </div>
            </div>;
          })}
        </div>
      </div>

    </div>
  );
}

// ── Projects View ─────────────────────────────────────────────────────────────
function ProjectsView({projects,setProjects}){
  const [showArchive,setShowArchive]=useState(false);
  const [pmpProjects,setPmpProjects]=useState([]);
  const [pmpLoading,setPmpLoading]=useState(false);
  // Load PMP projects ONCE for all cards
  useEffect(()=>{
    let cancelled=false;
    setPmpLoading(true);
    fetch("/api/pmp/projects")
      .then(r=>r.ok?r.json():[])
      .then(data=>{ if(!cancelled){ const list=data?.data||data?.items||data||[]; setPmpProjects(Array.isArray(list)?list:[]); } })
      .catch(()=>{})
      .finally(()=>{ if(!cancelled) setPmpLoading(false); });
    return ()=>{cancelled=true;};
  },[]);
  const [adding,setAdding]=useState(false);
  const [newP,setNewP]=useState({label:"",color:"#8b5cf6",description:"",links:[""]});
  const visible=projects.filter(p=>showArchive?p.archived:!p.archived);
  async function addProject(){
    if(!newP.label.trim()) return;
    try {
      const created = await api.createProject({...newP, links:newP.links.filter(l=>l.trim())});
      setProjects(p=>[...p,{...created,links:created.links||[],archived:false}]);
      setNewP({label:"",color:"#8b5cf6",description:"",links:[""]});
      setAdding(false);
    } catch(e){ alert("Ошибка: "+e.message); }
  }
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <h2 style={{fontSize:17,fontWeight:800,margin:0,color:"#f59e0b"}}>📁 Проекты</h2>
      <div style={{marginLeft:"auto",display:"flex",gap:8}}>
        <button onClick={()=>setShowArchive(p=>!p)} style={{background:"transparent",border:`1px solid ${showArchive?"#f59e0b":"#2d2d44"}`,borderRadius:8,padding:"6px 12px",color:showArchive?"#f59e0b":"#4b5563",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>{showArchive?"← Активные":"🗄 Архив"}</button>
        {!showArchive&&<button onClick={()=>setAdding(true)} style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Добавить проект</button>}
      </div>
    </div>
    {adding&&<div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:12,padding:"16px",marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:12,color:"#f59e0b"}}>+ Новый проект</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:10}}>
        <Field label="НАЗВАНИЕ"><input value={newP.label} onChange={e=>setNewP(p=>({...p,label:e.target.value}))} placeholder="Название клиента / бренда" style={SI}/></Field>
        <Field label="ЦВЕТ"><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:3}}>{AVATAR_COLORS.map(c=><div key={c} onClick={()=>setNewP(p=>({...p,color:c}))} style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",border:newP.color===c?"3px solid #fff":"3px solid transparent"}}/>)}</div></Field>
      </div>
      <Field label="ОПИСАНИЕ"><textarea value={newP.description} onChange={e=>setNewP(p=>({...p,description:e.target.value}))} placeholder="ЦА, тон, особенности бренда..." style={{...SI,minHeight:65,resize:"vertical",lineHeight:1.5}}/></Field>
      <Field label="ССЫЛКИ">
        {newP.links.map((l,i)=><div key={i} style={{display:"flex",gap:5,marginBottom:4}}>
          <input value={l} onChange={e=>setNewP(p=>({...p,links:p.links.map((x,j)=>j===i?e.target.value:x)}))} placeholder="https://..." style={{...SI,flex:1}}/>
          <button onClick={()=>setNewP(p=>({...p,links:p.links.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer"}}>×</button>
        </div>)}
        <button onClick={()=>setNewP(p=>({...p,links:[...p.links,""]}))} style={{background:"transparent",border:"1px dashed #2d2d44",borderRadius:6,padding:"4px 12px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>+ Ссылка</button>
      </Field>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={()=>setAdding(false)} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
        <button onClick={addProject} style={{flex:2,background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Создать</button>
      </div>
    </div>}
    {visible.length===0&&!adding&&<div style={{textAlign:"center",padding:"50px 0",color:"#9ca3af"}}><div style={{fontSize:36,marginBottom:8}}>📁</div><div style={{fontSize:12,color:"#9ca3af"}}>{showArchive?"Архив пуст":"Нет активных проектов"}</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))",gap:12}}>
      {visible.map(proj=>(
        <ProjectCard key={proj.id} proj={proj} showArchive={showArchive} setProjects={setProjects} pmpProjects={pmpProjects} pmpLoading={pmpLoading}/>
      ))}
    </div>
  </div>;
}

function ProjectCard({proj, showArchive, setProjects, pmpProjects=[], pmpLoading=false}){
  const [nl,setNl]=useState("");
  const loadingPmp=pmpLoading;
  const pmpErr="";

  function savePmpId(val){
    setProjects(p=>p.map(x=>x.id===proj.id?{...x,pmp_project_id:val}:x));
    api.updateProject(proj.id,{pmp_project_id:val}).catch(()=>{});
  }

  return <div style={{background:"#111118",border:'1px solid #1e1e2e',borderTop:'3px solid #2d2d44',borderRadius:12,padding:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:proj.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{proj.label[0]}</div>
            <input value={proj.label} onChange={e=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,label:e.target.value}:x))} onBlur={e=>api.updateProject(proj.id,{label:e.target.value}).catch(()=>{})} style={{...SI,flex:1,padding:"4px 8px",fontSize:13,fontWeight:700}}/>
            <button onClick={async()=>{ const v=!proj.archived; await api.updateProject(proj.id,{archived:v}); setProjects(p=>p.map(x=>x.id===proj.id?{...x,archived:v}:x)); }} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"4px 8px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>{showArchive?"↩":"🗄"}</button>
            <button onClick={async()=>{if(!window.confirm("Удалить проект «"+proj.label+"»? Это действие нельзя отменить.")) return; try{await api.deleteProject(proj.id);setProjects(p=>p.filter(x=>x.id!==proj.id));}catch(e){alert("Ошибка: "+e.message);}}} style={{background:"transparent",border:"1px solid #ef444440",borderRadius:6,padding:"4px 8px",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑</button>
          </div>
          <textarea value={proj.description} onChange={e=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,description:e.target.value}:x))} onBlur={e=>api.updateProject(proj.id,{description:e.target.value}).catch(()=>{})} placeholder="Описание проекта..." style={{...SI,minHeight:60,resize:"vertical",lineHeight:1.5,marginBottom:8,fontSize:11}}/>

          {/* ── Post My Post linking ── */}
          <div style={{background:"#0a0f1a",border:"1px solid #1e3a5f",borderRadius:8,padding:"9px 11px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
              <span style={{fontSize:11}}>📡</span>
              <span style={{fontSize:10,fontWeight:700,color:"#38bdf8"}}>Post My Post</span>
              {proj.pmp_project_id&&<span style={{fontSize:9,background:"#10b98115",color:"#10b981",border:"1px solid #10b98130",borderRadius:10,padding:"1px 7px",fontFamily:"monospace"}}>✅ привязан</span>}
            </div>
            {loadingPmp
              ? <div style={{fontSize:10,color:"#6b7280"}}>⏳ Загружаю проекты PMP...</div>
              : pmpErr
                ? <div style={{fontSize:10,color:"#6b7280"}}>{pmpErr}</div>
                : pmpProjects.length>0
                  ? <select value={proj.pmp_project_id||""} onChange={e=>savePmpId(e.target.value)} style={{...SI,fontSize:11}}>
                      <option value="">— не привязан —</option>
                      {pmpProjects.map(p=><option key={p.id} value={p.id}>{p.name||p.title||("Проект "+p.id)}</option>)}
                    </select>
                  : <div style={{fontSize:10,color:"#4b5563"}}>Нет проектов (проверь POSTMYPOST_TOKEN)</div>
            }
          </div>

          <span style={LB}>ДОКУМЕНТЫ И ССЫЛКИ</span>
          {proj.links.filter(l=>l).map((l,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
            <a href={l} target="_blank" rel="noreferrer" style={{flex:1,fontSize:11,color:"#a78bfa",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {l}</a>
            <button onClick={()=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,links:x.links.filter((_,j)=>j!==i)}:x))} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:11}}>×</button>
          </div>)}
          <div style={{display:"flex",gap:5,marginTop:4}}>
            <input value={nl} onChange={e=>setNl(e.target.value)} placeholder="https://..." style={{...SI,flex:1,fontSize:11,padding:"5px 8px"}} onKeyDown={e=>{if(e.key==="Enter"&&nl){setProjects(p=>p.map(x=>x.id===proj.id?{...x,links:[...x.links,nl]}:x));setNl("");}}}/>
            <button onClick={()=>{if(nl){setProjects(p=>p.map(x=>x.id===proj.id?{...x,links:[...x.links,nl]}:x));setNl("");}}} style={{background:"#1e1e35",border:"1px solid #3d3d5c",borderRadius:6,padding:"0 10px",color:"#a78bfa",cursor:"pointer",fontSize:15}}>+</button>
          </div>
        </div>;
}

// ── Team View ─────────────────────────────────────────────────────────────────
function TeamView({teamMembers,setTeamMembers,currentUser}){
  const isDirector = currentUser?.role==="Директор" || currentUser?.telegram==="evg_vinogradov";
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
          <div style={{width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${m.color},${m.color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff",flexShrink:0}}>{(m.name[0]||"?").toUpperCase()}</div>
          <div style={{flex:1}}>
            <input value={m.name} onChange={e=>isDirector&&setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,name:e.target.value}:x))} onBlur={e=>isDirector&&api.updateUser(m.id,{name:e.target.value}).catch(()=>{})} readOnly={!isDirector} style={{...SI,padding:"3px 7px",fontSize:13,fontWeight:700,marginBottom:3,opacity:isDirector?1:0.7}}/>
            <select value={m.role} onChange={e=>isDirector&&setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,role:e.target.value}:x))} disabled={!isDirector} style={{...SI,padding:"2px 7px",fontSize:10,opacity:isDirector?1:0.7}}>{ROLES_LIST.map(r=><option key={r} value={r}>{r}</option>)}</select>
          </div>
          {isDirector&&<button onClick={async()=>{ await api.deleteUser(m.id).catch(()=>{}); setTeamMembers(p=>p.filter(x=>x.id!==m.id)); }} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14,alignSelf:"flex-start"}}>×</button>}
        </div>
        <input value={m.telegram} onChange={e=>setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,telegram:e.target.value}:x))} placeholder="@telegram" style={{...SI,marginBottom:6,fontSize:11}}/>
        <textarea value={m.note} onChange={e=>setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,note:e.target.value}:x))} placeholder="Заметки..." style={{...SI,minHeight:50,resize:"vertical",fontSize:11,lineHeight:1.4,marginBottom:8}}/>

      </div>)}
    </div>
  </div>;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  // ── Auth ──────────────────────────────────────────────────────────────────
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

function MainApp({currentUser, onLogout}){
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
  const [modal,setModal]=useState(null);
  const saveFnRef = useRef(null);
  // Stores object for useTaskStore — avoids repeated chains
  const stores = {preItems,setPreItems,prodItems,setProdItems,postReels,setPostReels,postVideo,setPostVideo,postCarousels,setPostCarousels,pubItems,setPubItems};
  const [loading,setLoading]=useState(true);

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
        setTeamMembers(users.map(u => ({...u, note: u.note || ""})));
        // Split tasks by type and merge data field
        const expand = t => {
          const d = t.data || {};
          return {
            id: t.id, project: t.project_id, status: t.status, title: t.title,
            completed_at: t.completed_at || "", chat: [],
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
      } catch(e) { console.error("Load error:", e); }
      setLoading(false);
    }
    loadAll();
  }, []);

  // Per-tab filters — must be before any conditional return!
  const [preFilt,setPreFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [prodFilt,setProdFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [postFilt,setPostFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [pubFilt,setPubFilt]=useState({pf:"all",member:"all",sortBy:"default"});
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

  const ct=TABS.find(t=>t.id===tab);

  function defItem(type,extra={}){
    const proj=activeProjs[0]?.id||"brandx";
    const base={pre:{id:genId(),title:"",type:"Сценарий",project:proj,status:"idea",brief:"",script:"",refs:[],deadline:"",scriptwriter:"",producer:"",chat:[]},
      prod:{id:genId(),title:"",type:"Рилс",project:proj,status:"planned",location:"",equipment:[],actors:[],shoot_date:"",checklist:[],producer:"",operator:"",chat:[]},
      post_reels:{id:genId(),title:"",project:proj,status:"not_started",source_name:"",source_url:"",transcript:"",tz:"",birolls:"",final_link:"",post_deadline:"",producer:"",editor:"",chat:[]},
      post_video:{id:genId(),title:"",project:proj,status:"not_started",source_links:[],tz:"",final_link:"",post_deadline:"",producer:"",editor:"",chat:[]},
      post_carousel:{id:genId(),title:"",project:proj,status:"not_started",slides:[{id:genId(),text:"",img:"",img_name:""}],cover_text:"",tz:"",final_link:"",post_deadline:"",producer:"",designer:"",chat:[]},
      pub:{id:genId(),title:"",project:proj,status:"draft",planned_date:"",caption:"",hashtags:"",producer:"",file_name:"",chat:[]},
    };
    return {...base[type],...extra};
  }

  function openNew(type,extra={}){ setModal({type,item:defItem(type,extra)}); }
  function openEdit(type,item){
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

  async function save(type,d){
    try {
      const { id, project, status, title, chat, archived, ...rest } = d;
      const payload = { type, title: title||"", project_id: project, status, archived: archived||false, data: rest };
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
  function drop(type,id,newStatus){
    const DONE_STATUSES=["done","approved","published"];
    const completedAt=DONE_STATUSES.includes(newStatus)?new Date().toISOString().slice(0,10):"";
    const [,setterDrop] = useTaskStore(type, stores);
    setterDrop(p=>p.map(x=>x.id===id?{...x,status:newStatus,...(completedAt?{completed_at:completedAt}:{})}:x));
    const patch={status:newStatus};
    if(completedAt) patch.completed_at=completedAt;
    api.updateTask(id, patch).catch(e=>console.error("Drop error:",e));
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
    return <div onClick={()=>openEdit(type,item)} style={{background:"#111118",border:`1px solid ${urgent?"#ef444450":"#1e1e2e"}`,borderLeft:`3px solid ${urgent?"#ef4444":"#374151"}`,borderRadius:8,padding:"10px 11px",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.background="#16161f"} onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
      <div style={{fontWeight:700,fontSize:12,marginBottom:5}}>{item.title||"Без названия"}</div>
      <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
        <Badge color="#374151">{proj.label}</Badge>
        {item.type&&<Badge color="#4b5563">{item.type}</Badge>}
        {item.slides&&<Badge color="#4b5563">📋 {item.slides.length} сл.</Badge>}
      </div>
      {/* Заказчик → Исполнитель */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:9,color:"#9ca3af"}}>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:cust?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{cust?cust.name:"заказчик"}</span>
        <span style={{color:"#9ca3af",flexShrink:0}}>→</span>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:exec?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{exec?exec.name:"исполнитель"}</span>
      </div>
      {/* Дедлайн */}
      {item.completed_at&&<div style={{fontSize:9,fontFamily:"monospace",color:"#10b981"}}>✅ Выполнено {item.completed_at}</div>}
      {!item.completed_at&&dateStr&&<div style={{fontSize:9,fontFamily:"monospace",color:urgent?"#ef4444":"#4b5563"}}>📅 {dateStr}{daysLeft!==null&&` (${daysLeft>0?daysLeft+"д":"сегодня"})`}</div>}
      <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center"}}>
        {chatCount>0&&<span style={{fontSize:9,color:"#9ca3af"}}>💬 {chatCount}</span>}
        {(type==="post_reels"||type==="post_video"||type==="post_carousel")&&<button onClick={e=>{
          e.stopPropagation();
          // Mark post task as done
          drop(type,item.id,"done");
          // Create new pub task carrying over final file/link
          const pubItem=defItem("pub",{
            title:item.title,
            project:item.project,
            file_name:item.final_file_name||item.source_name||"",
            file_url:item.final_file_url||item.source_url||"",
            pub_type:type==="post_carousel"?"carousel":"video",
            slides:type==="post_carousel"?(item.slides||[]):[],
          });
          setModal({type:"pub",item:pubItem});
        }} style={{background:"transparent",border:"1px dashed #10b98140",borderRadius:5,padding:"2px 7px",color:"#10b981",cursor:"pointer",fontSize:9}}>🚀 → Публ.</button>}
        {item.archived&&<Badge color="#4b5563">📦 архив</Badge>}
        <button onClick={e=>{e.stopPropagation();archiveTask(type,item.id);}} title={item.archived?"Разархивировать":"Архивировать"} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:10,padding:"0 2px"}}>{item.archived?"↩":"📦"}</button>
      </div>
    </div>;
  }

  const cnt={pre:preItems.length,prod:prodItems.length,post:postReels.length+postVideo.length+postCarousels.length,pub:pubItems.length,summary:0,projects:activeProjs.length,team:teamMembers.length};

  return <div style={{fontFamily:"'Syne','Inter',sans-serif",height:"100vh",background:"#0a0a0f",color:"#f0eee8",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* TOP NAV — no filters, no add button */}
    <div style={{borderBottom:"1px solid #1a1a2e",background:"#0d0d16",flexShrink:0,padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:2,height:52}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:12}}>
          <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>🍇</div>
          <div><div style={{fontSize:14,fontWeight:800}}>{APP_NAME}</div><div style={{fontSize:8,color:"#9ca3af",fontFamily:"monospace"}}>production system</div></div>
        </div>
        {TABS.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setViewMode("kanban");}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,cursor:"pointer",background:tab===t.id?t.color+"15":"transparent",border:tab===t.id?`1px solid ${t.color}40`:"1px solid transparent",color:tab===t.id?t.color:"#9ca3af",fontFamily:"inherit",fontWeight:tab===t.id?700:500,fontSize:12}}>
          <span style={{fontSize:13}}>{t.icon}</span>{t.label}
          {t.id!=="summary"&&<span style={{fontSize:9,background:tab===t.id?t.color+"25":"#1a1a2e",borderRadius:20,padding:"0 6px",color:tab===t.id?t.color:"#9ca3af",fontFamily:"monospace",fontWeight:700}}>{cnt[t.id]}</span>}
        </button>)}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:"#111118",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:`linear-gradient(135deg,${currentUser.color||"#8b5cf6"},#7c3aed)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}}>{(currentUser.name||currentUser.telegram||"?")[0].toUpperCase()}</div>
            <span style={{fontSize:11,fontWeight:600}}>@{currentUser.telegram}</span>
          </div>
          <button onClick={onLogout} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Выйти</button>
        </div>
      </div>
    </div>

    {/* CONTENT */}
    <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>

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
          {[{id:"week",l:"Неделя"},{id:"calendar",l:"Месяц"},{id:"status",l:"По статусам"}].map(v=><button key={v.id} onClick={()=>setPubViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:pubViewMode===v.id?"#10b98120":"transparent",border:pubViewMode===v.id?"1px solid #10b98140":"1px solid #1e1e2e",color:pubViewMode===v.id?"#10b981":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {pubViewMode==="week"&&<WeekView items={filtPub} onItemClick={x=>openEdit("pub",x)} onDayClick={dt=>openNew("pub",{planned_date:dt})} projects={projects} onMoveToDay={(id,dt)=>moveToDay("pub",id,dt)}/>}
        {pubViewMode==="calendar"&&<CalView items={filtPub} dateField="planned_date" onDayClick={d=>openNew("pub",{planned_date:d+"T12:00"})} color="#10b981" onMoveToDay={(id,day)=>moveToDay("pub",id,day+"T12:00")} renderChip={x=>{const sc=stColor(PUB_STATUSES,x.status);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("pub",x);}} style={{background:sc+"18",border:`1px solid ${sc}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:sc,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.title}</div>;}}/>}
        {pubViewMode==="status"&&<Kanban statuses={PUB_STATUSES} items={filtPub} onDrop={(id,st)=>drop("pub",id,st)} onAddClick={st=>openNew("pub",{status:st})} renderCard={x=>mkCard(x,"pub")}/>}
      </>}

      {tab==="summary"&&<SummaryView preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} projects={projects} team={teamMembers} currentUser={currentUser} onOpenTask={(type,item)=>openEdit(type,item)}/>}
      {tab==="projects"&&<ProjectsView projects={projects} setProjects={setProjects}/>}
      {tab==="team"&&<TeamView teamMembers={teamMembers} setTeamMembers={setTeamMembers} currentUser={currentUser}/>}
    </div>

    {/* MODALS */}
    {modal?.type==="pre"          &&<Modal title="✍️ Препродакшн — Сценарий"  color="#8b5cf6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pre",modal.item.id):undefined}><PreForm          item={modal.item} onSave={d=>save("pre",d)} onDelete={id=>deleteTask("pre",id)}           onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="prod"         &&<Modal title="🎬 Продакшн — Съёмка"       color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("prod",modal.item.id):undefined}><ProdForm         item={modal.item} onSave={d=>save("prod",d)} onDelete={id=>deleteTask("prod",id)}          onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="post_reels"   &&<Modal title="🎞️ Постпродакшн — Рилс"    color="#ec4899" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_reels",modal.item.id):undefined}><PostReelsForm    item={modal.item} onSave={d=>save("post_reels",d)} onDelete={id=>deleteTask("post_reels",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="post_video"   &&<Modal title="🎬 Постпродакшн — Видео"    color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_video",modal.item.id):undefined}><PostVideoForm    item={modal.item} onSave={d=>save("post_video",d)} onDelete={id=>deleteTask("post_video",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="post_carousel"&&<Modal title="🖼 Постпродакшн — Карусель" color="#a78bfa" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_carousel",modal.item.id):undefined}><PostCarouselForm item={modal.item} onSave={d=>save("post_carousel",d)} onDelete={id=>deleteTask("post_carousel",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser}/></Modal>}
    {modal?.type==="pub"          &&<Modal title="🚀 Публикация"               color="#10b981" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pub",modal.item.id):undefined}><PubForm          item={modal.item} onSave={d=>save("pub",d)} onDelete={id=>deleteTask("pub",id)}           onClose={close} saveFnRef={saveFnRef} projects={projects} team={teamMembers} currentUser={currentUser}/></Modal>}
  </div>;
}
