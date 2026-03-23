import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";
import { Kanban, CalView, WeekView } from "../kanban";

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

export { SummaryView, UnreadMentions };
