import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS, TABS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";

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
    <div style={{width:240,borderRight:"1px solid #1e1e2e",overflowY:"auto",flexShrink:0,padding:"16px 10px"}}>
      <div style={{fontSize:10,color:"#4b5563",fontFamily:"monospace",fontWeight:700,marginBottom:10,padding:"0 8px"}}>ПРОЕКТЫ</div>
      <button onClick={()=>setSelectedProject(null)}
        style={{width:"100%",textAlign:"left",padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:5,
          background:!selectedProject?"#f59e0b20":"transparent",
          color:!selectedProject?"#f59e0b":"#9ca3af",fontFamily:"inherit",fontSize:13,fontWeight:!selectedProject?700:400}}>
        🗂 Все проекты
        <span style={{float:"right",fontSize:11,opacity:0.7}}>{allTasks.length}</span>
      </button>
      {activeProjects.map(p => {
        const cnt = allTasks.filter(t=>t.project===p.id).length;
        return <button key={p.id} onClick={()=>setSelectedProject(p.id)}
          style={{width:"100%",textAlign:"left",padding:"9px 12px",borderRadius:8,border:"none",cursor:"pointer",marginBottom:3,
            background:selectedProject===p.id?p.color+"20":"transparent",
            color:selectedProject===p.id?p.color:"#9ca3af",fontFamily:"inherit",fontSize:13,fontWeight:selectedProject===p.id?700:400}}>
          <span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:p.color,marginRight:8,verticalAlign:"middle"}}/>
          {p.label}
          <span style={{float:"right",fontSize:11,opacity:0.7}}>{cnt}</span>
        </button>;
      })}
    </div>

    {/* Right: tasks */}
    <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        {proj
          ? <><span style={{width:14,height:14,borderRadius:"50%",background:proj.color,display:"inline-block"}}/>
              <span style={{fontSize:20,fontWeight:800,color:proj.color}}>{proj.label}</span></>
          : <span style={{fontSize:20,fontWeight:800,color:"#f0eee8"}}>Все проекты</span>}
        <span style={{fontSize:12,color:"#4b5563",fontFamily:"monospace"}}>{tasks.length} задач</span>
      </div>

      {Object.keys(typeLabel).map(type => {
        const items = byType[type] || [];
        if (!items.length) return null;
        const isOpen = expandedTypes[type] !== false; // open by default
        const color = typeColor[type];
        return <div key={type} style={{marginBottom:12}}>
          <div onClick={()=>toggleType(type)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:"#111118",border:"1px solid #1e1e2e",borderRadius:isOpen?"8px 8px 0 0":8,cursor:"pointer",userSelect:"none"}}>
            <span style={{fontSize:11,color,fontFamily:"monospace",fontWeight:700,flex:1}}>{typeLabel[type].toUpperCase()}</span>
            <span style={{fontSize:11,background:color+"20",color,borderRadius:8,padding:"2px 10px",fontFamily:"monospace"}}>{items.length}</span>
            <span style={{fontSize:12,color:"#4b5563"}}>{isOpen?"▾":"▸"}</span>
          </div>
          {isOpen && <div style={{border:"1px solid #1e1e2e",borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
            {items.map((item,i) => {
              const sc = statusColors[item.status] || "#6b7280";
              const itemProj = !selectedProject ? projects.find(p=>p.id===item.project) : null;
              return <div key={item.id}
                onClick={()=>onOpenTask(item._type, item)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",borderTop:i===0?"none":"1px solid #1e1e2e",cursor:"pointer",background:"#0d0d16"}}
                onMouseEnter={e=>e.currentTarget.style.background="#111118"}
                onMouseLeave={e=>e.currentTarget.style.background="#0d0d16"}>
                <span style={{width:8,height:8,borderRadius:"50%",background:sc,flexShrink:0}}/>
                <span style={{flex:1,fontSize:14,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</span>
                {itemProj&&<span style={{fontSize:11,color:itemProj.color,background:itemProj.color+"18",borderRadius:5,padding:"2px 9px",fontFamily:"monospace",flexShrink:0}}>{itemProj.label}</span>}
                <span style={{fontSize:11,color:sc,background:sc+"18",borderRadius:5,padding:"2px 9px",fontFamily:"monospace",flexShrink:0,whiteSpace:"nowrap"}}>{item.status}</span>
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

export default ProjectsView;
