import React, { useState } from "react";
import { SI, LB } from "../../constants";
import { xhrUpload } from "../../utils/files";

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

function TzField({value, onChange, placeholder, label, minHeight=100}) {
  const [editing, setEditing] = React.useState(false);
  function renderWithLinks(text) {
    if (!text) return <span style={{color:"#4b5563",fontSize:11}}>{placeholder}</span>;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part)
        ? <a key={i} href={part} target="_blank" rel="noreferrer"
            style={{color:"#06b6d4",wordBreak:"break-all",textDecoration:"underline"}}
            onClick={e=>e.stopPropagation()}>{part}</a>
        : <span key={i} style={{whiteSpace:"pre-wrap"}}>{part}</span>
    );
  }
  return <Field label={label}>
    {editing
      ? <textarea
          autoFocus
          value={value||""}
          onChange={e=>onChange(e.target.value)}
          onBlur={()=>setEditing(false)}
          placeholder={placeholder}
          style={{...SI,minHeight,resize:"vertical",lineHeight:1.5}}
        />
      : <div
          onClick={()=>setEditing(true)}
          style={{...SI,minHeight,lineHeight:1.5,cursor:"text",whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:12,color:"#f0eee8"}}
        >{renderWithLinks(value)}</div>
    }
  </Field>;
}

function StatusRow({statuses,value,onChange}){
  return <Field label="СТАТУС">
    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {statuses.map(s=><button key={s.id} onClick={()=>onChange(s.id)} style={{flex:1,minWidth:80,padding:"6px 4px",borderRadius:7,cursor:"pointer",background:value===s.id?s.c+"20":"#111118",border:`1px solid ${value===s.id?s.c:"#2d2d44"}`,color:value===s.id?s.c:"#4b5563",fontSize:9,fontFamily:"monospace"}}>{s.l}</button>)}
    </div>
  </Field>;
}

function SaveRow({onClose,onSave,onDelete,color}){
  const [confirmDel,setConfirmDel]=useState(false);
  return <div style={{display:"flex",gap:8,marginTop:4,paddingTop:8,borderTop:"1px solid #1e1e2e"}}>
    {onDelete&&!confirmDel&&<button onClick={()=>setConfirmDel(true)} title="Удалить задачу" style={{background:"transparent",border:"1px solid #ef444440",borderRadius:8,padding:"8px 12px",color:"#ef4444",cursor:"pointer",fontSize:14}}>🗑</button>}
    {onDelete&&confirmDel&&<><button onClick={onDelete} style={{background:"#ef4444",border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Удалить!</button><button onClick={()=>setConfirmDel(false)} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px 10px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>✕</button></>}
    <button onClick={onClose} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
    <button onClick={onSave} style={{flex:2,background:`linear-gradient(135deg,${color},${color}cc)`,border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Сохранить</button>
  </div>;
}

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


export { Badge, Field, Btn, TeamSelect, UploadProgress, TzField, StatusRow, SaveRow, FilterBar };

export { default as TaskCard } from "./TaskCard";
