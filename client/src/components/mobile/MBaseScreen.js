import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";
import { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard } from "./MobileUI";

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

export default MBaseScreen;
