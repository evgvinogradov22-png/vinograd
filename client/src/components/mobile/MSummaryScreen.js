import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";
import { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard } from "./MobileUI";

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

export default MSummaryScreen;
