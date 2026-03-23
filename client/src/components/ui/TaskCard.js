import React from "react";
import { PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { projOf, teamOf } from "../../utils/helpers";
import { Badge } from "../ui";

function TaskCard({ item, type, projects, team, onOpen, onDrop, onArchive, onSendToPub, onToggleStar, defItem }) {
  const proj = projOf(item.project, projects);
  const chatCount = (item.chat || []).length;
  const custId = item.customer || item.producer || "";
  const execId = item.executor || item.editor || item.scriptwriter || item.operator || item.designer || "";
  const cust = teamOf(custId, team);
  const exec = teamOf(execId, team);
  const dateStr = item.deadline || item.shoot_date?.slice(0,10) || item.planned_date?.slice(0,10) || item.post_deadline || "";
  const daysLeft = dateStr ? Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000) : null;
  const urgent = daysLeft !== null && daysLeft <= 2;

  const border = item.starred ? "#f59e0b50" : urgent ? "#ef444450" : "#1e1e2e";
  const borderLeft = item.starred ? "#f59e0b" : urgent ? "#ef4444" : "#374151";

  return (
    <div onClick={() => onOpen(type, item)}
      style={{background:"#111118",borderTop:`1px solid ${border}`,borderRight:`1px solid ${border}`,borderBottom:`1px solid ${border}`,borderLeft:`3px solid ${borderLeft}`,borderRadius:8,padding:"10px 11px",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
      onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
      <div style={{display:"flex",alignItems:"flex-start",gap:5,marginBottom:5}}>
        <div style={{fontWeight:700,fontSize:12,flex:1}}>{item.title||"Без названия"}</div>
        {type==="pub" && <button onClick={e=>{e.stopPropagation();onToggleStar(type,item);}}
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
        {type==="post_carousel"&&item.slides?.length>0&&<Badge color="#4b5563">📋 {item.slides.length} сл.</Badge>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:9,color:"#9ca3af"}}>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:cust?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{cust?cust.name:"заказчик"}</span>
        <span style={{color:"#9ca3af",flexShrink:0}}>→</span>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:exec?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{exec?exec.name:"исполнитель"}</span>
      </div>
      {item.completed_at&&item.status==="done"&&<div style={{fontSize:9,fontFamily:"monospace",color:"#10b981"}}>✅ Выполнено {item.completed_at}</div>}
      {!item.completed_at&&dateStr&&<div style={{fontSize:9,fontFamily:"monospace",color:urgent?"#ef4444":"#4b5563"}}>📅 {dateStr}{daysLeft!==null&&` (${daysLeft>0?daysLeft+"д":"сегодня"})`}</div>}
      <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center"}}>
        {chatCount>0&&<span style={{fontSize:9,color:"#9ca3af"}}>💬 {chatCount}</span>}
        {(type==="post_reels"||type==="post_video"||type==="post_carousel")&&item.status==="done"&&onSendToPub&&
          <button onClick={e=>{e.stopPropagation();onSendToPub(type,item);}}
            style={{background:"transparent",border:"1px dashed #10b98140",borderRadius:5,padding:"2px 7px",color:"#10b981",cursor:"pointer",fontSize:9}}>🚀 → Публ.</button>}
        {item.archived&&<Badge color="#4b5563">📦 архив</Badge>}
        {(item.archived||["done","approved","published","cancelled"].includes(item.status))&&
          <button onClick={e=>{e.stopPropagation();onArchive(type,item.id);}}
            title={item.archived?"Из архива":"В архив"}
            style={{marginLeft:"auto",background:"transparent",border:"none",color:item.archived?"#10b981":"#6b7280",cursor:"pointer",fontSize:10,padding:"0 2px"}}>
            {item.archived?"↩":"📦"}</button>}
      </div>
    </div>
  );
}

export default TaskCard;
