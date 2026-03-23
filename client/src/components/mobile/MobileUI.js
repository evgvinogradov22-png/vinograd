import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";

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

function MStatusBadge({status, statuses}){
  const st = statuses.find(s=>s.id===status)||{l:status,c:"#6b7280"};
  return <MTag color={STATUS_COLOR_KEY(st.c)}>{st.l}</MTag>;
}

function MAvatar({member, size=28}){
  if(!member) return null;
  return <div style={{width:size,height:size,borderRadius:"50%",background:member.color||"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,fontWeight:800,color:"#fff",border:"2px solid #0d0d14",flexShrink:0}}>{(member.name||"?")[0].toUpperCase()}</div>;
}

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

export { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard };
