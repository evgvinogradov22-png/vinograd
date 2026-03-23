import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";
import { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard } from "./MobileUI";

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

export default MPubScreen;
