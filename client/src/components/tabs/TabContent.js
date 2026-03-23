import React from "react";
import { PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { FilterBar } from "../ui";
import { Kanban, CalView, WeekView } from "../kanban";
import StarredReelsView from "../views/StarredReelsView";

function CalChip({ item, color, prefix = "", onOpen }) {
  return <div onClick={e => { e.stopPropagation(); onOpen(item); }} style={{ background: color + "18", border: `1px solid ${color}30`, borderRadius: 4, padding: "2px 4px", marginBottom: 2, fontSize: 9, color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prefix}{item.title}</div>;
}

export function PreTab({ items, filt, setFilt, viewMode, setViewMode, projects, team, openNew, openEdit, drop, showArchived, setShowArchived }) {
  const c = "#8b5cf6";
  return <>
    <FilterBar pf={filt.pf} setPf={v=>setFilt(p=>({...p,pf:v}))} member={filt.member} setMember={v=>setFilt(p=>({...p,member:v}))} sortBy={filt.sortBy} setSortBy={v=>setFilt(p=>({...p,sortBy:v}))} projects={projects} team={team} addLabel="Сценарий" onAdd={()=>openNew("pre")} showArchived={showArchived} onArchiveToggle={()=>setShowArchived(p=>!p)}/>
    <div style={{display:"flex",gap:6,marginBottom:12}}>{[{id:"kanban",l:"Канбан"},{id:"calendar",l:"Календарь"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?c+"20":"transparent",border:viewMode===v.id?`1px solid ${c}40`:"1px solid #1e1e2e",color:viewMode===v.id?c:"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}</div>
    {viewMode==="kanban"&&<Kanban statuses={PRE_STATUSES} items={items} renderCard={x=>x._card} onDrop={(id,st)=>drop("pre",id,st)} onAddClick={st=>openNew("pre",{status:st})}/>}
    {viewMode==="calendar"&&<CalView items={items} dateField="deadline" onDayClick={d=>openNew("pre",{deadline:d})} color={c} onMoveToDay={(id,day)=>{const item=items.find(x=>x.id===id);if(item){const{id:_,project,status,title,chat,...rest}=item;api.updateTask(id,{data:{...rest,deadline:day}}).catch(()=>{});}}} renderChip={x=>{const p=projOf(x.project,projects);return <CalChip item={x} color={p.color} onOpen={i=>openEdit("pre",i)}/>;}}/>}
  </>;
}

export function ProdTab({ items, filt, setFilt, viewMode, setViewMode, projects, team, openNew, openEdit, drop, moveToDay, showArchived, setShowArchived }) {
  const c = "#3b82f6";
  return <>
    <FilterBar pf={filt.pf} setPf={v=>setFilt(p=>({...p,pf:v}))} member={filt.member} setMember={v=>setFilt(p=>({...p,member:v}))} sortBy={filt.sortBy} setSortBy={v=>setFilt(p=>({...p,sortBy:v}))} projects={projects} team={team} addLabel="Съёмку" onAdd={()=>openNew("prod")} showArchived={showArchived} onArchiveToggle={()=>setShowArchived(p=>!p)}/>
    <div style={{display:"flex",gap:6,marginBottom:12}}>{[{id:"kanban",l:"Канбан"},{id:"calendar",l:"Съёмки"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?c+"20":"transparent",border:viewMode===v.id?`1px solid ${c}40`:"1px solid #1e1e2e",color:viewMode===v.id?c:"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}</div>
    {viewMode==="kanban"&&<Kanban statuses={PROD_STATUSES} items={items} renderCard={x=>x._card} onDrop={(id,st)=>drop("prod",id,st)} onAddClick={st=>openNew("prod",{status:st})}/>}
    {viewMode==="calendar"&&<CalView items={items} dateField="shoot_date" onDayClick={d=>openNew("prod",{shoot_date:d+"T10:00"})} color={c} onMoveToDay={(id,day)=>moveToDay("prod",id,day+"T10:00")} renderChip={x=>{const p=projOf(x.project,projects);return <CalChip item={x} color={p.color} prefix="🎬 " onOpen={i=>openEdit("prod",i)}/>;}}/>}
  </>;
}

export function PostTab({ reels, video, carousels, filt, setFilt, subTab, setSubTab, projects, team, openNew, drop, showArchived, setShowArchived }) {
  const addType = subTab==="reels"?"post_reels":subTab==="video"?"post_video":"post_carousel";
  const addLabel = subTab==="reels"?"Рилс":subTab==="video"?"Видео":"Карусель";
  return <>
    <FilterBar pf={filt.pf} setPf={v=>setFilt(p=>({...p,pf:v}))} member={filt.member} setMember={v=>setFilt(p=>({...p,member:v}))} sortBy={filt.sortBy} setSortBy={v=>setFilt(p=>({...p,sortBy:v}))} projects={projects} team={team} addLabel={addLabel} onAdd={()=>openNew(addType)} showArchived={showArchived} onArchiveToggle={()=>setShowArchived(p=>!p)}/>
    <div style={{display:"flex",gap:6,marginBottom:12}}>{[["reels","🎞️ Рилсы","#ec4899"],["video","🎬 Видео","#3b82f6"],["carousel","🖼 Карусели","#a78bfa"]].map(([id,l,c])=><button key={id} onClick={()=>setSubTab(id)} style={{padding:"4px 11px",borderRadius:6,cursor:"pointer",background:subTab===id?c+"20":"transparent",border:subTab===id?`1px solid ${c}40`:"1px solid #1e1e2e",color:subTab===id?c:"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:600}}>{l}</button>)}</div>
    {subTab==="reels"&&<Kanban statuses={POST_STATUSES} items={reels} renderCard={x=>x._card} onDrop={(id,st)=>drop("post_reels",id,st)} onAddClick={st=>openNew("post_reels",{status:st})}/>}
    {subTab==="video"&&<Kanban statuses={POST_STATUSES} items={video} renderCard={x=>x._card} onDrop={(id,st)=>drop("post_video",id,st)} onAddClick={st=>openNew("post_video",{status:st})}/>}
    {subTab==="carousel"&&<Kanban statuses={POST_STATUSES} items={carousels} renderCard={x=>x._card} onDrop={(id,st)=>drop("post_carousel",id,st)} onAddClick={st=>openNew("post_carousel",{status:st})}/>}
  </>;
}

export function PubTab({ items, allItems, filt, setFilt, viewMode, setViewMode, projects, team, openNew, openEdit, drop, moveToDay, toggleStar, showArchived, setShowArchived }) {
  const c = "#10b981";
  return <>
    <FilterBar pf={filt.pf} setPf={v=>setFilt(p=>({...p,pf:v}))} member={filt.member} setMember={v=>setFilt(p=>({...p,member:v}))} sortBy={filt.sortBy} setSortBy={v=>setFilt(p=>({...p,sortBy:v}))} projects={projects} team={team} addLabel="Публикацию" onAdd={()=>openNew("pub")} showArchived={showArchived} onArchiveToggle={()=>setShowArchived(p=>!p)}/>
    <div style={{display:"flex",gap:6,marginBottom:12}}>{[{id:"week",l:"Неделя"},{id:"calendar",l:"Месяц"},{id:"status",l:"По статусам"},{id:"published",l:"Опубликованные"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?c+"20":"transparent",border:viewMode===v.id?`1px solid ${c}40`:"1px solid #1e1e2e",color:viewMode===v.id?c:"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}</div>
    {viewMode==="week"&&<div style={{overflow:"hidden",width:"100%"}}><WeekView items={items} onItemClick={x=>openEdit("pub",x)} onDayClick={dt=>openNew("pub",{planned_date:dt})} projects={projects} onMoveToDay={(id,dt)=>moveToDay("pub",id,dt)} onToggleStar={x=>toggleStar("pub",x)}/></div>}
    {viewMode==="calendar"&&<CalView items={items} dateField="planned_date" onDayClick={d=>openNew("pub",{planned_date:d+"T12:00"})} color={c} onMoveToDay={(id,day)=>moveToDay("pub",id,day+"T12:00")} renderChip={x=>{const sc=stColor(PUB_STATUSES,x.status);return <CalChip item={x} color={sc} onOpen={i=>openEdit("pub",i)}/>;}}/>}
    {viewMode==="status"&&<Kanban statuses={PUB_STATUSES.filter(s=>s.id!=="published")} items={items.filter(x=>x.status!=="published")} onDrop={(id,st)=>drop("pub",id,st)} onAddClick={st=>openNew("pub",{status:st})} renderCard={x=>x._card}/>}
    {viewMode==="published"&&<StarredReelsView pubItems={allItems} projects={projects}/>}
  </>;
}

export function AdminTab({ items, filt, setFilt, projects, team, openNew, drop, showArchived, setShowArchived }) {
  return <>
    <FilterBar pf={filt.pf} setPf={v=>setFilt(p=>({...p,pf:v}))} member={filt.member} setMember={v=>setFilt(p=>({...p,member:v}))} sortBy={filt.sortBy} setSortBy={v=>setFilt(p=>({...p,sortBy:v}))} projects={projects} team={team} addLabel="Задачу" onAdd={()=>openNew("admin")} showArchived={showArchived} onArchiveToggle={()=>setShowArchived(p=>!p)}/>
    <Kanban statuses={ADMIN_STATUSES} items={items} renderCard={x=>x._card} onDrop={(id,st)=>drop("admin",id,st)} onAddClick={st=>openNew("admin",{status:st})}/>
  </>;
}
