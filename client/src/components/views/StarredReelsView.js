import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";
import { Kanban, CalView, WeekView } from "../kanban";

function StarredReelsView({pubItems, projects}){
  const now = new Date();
  const [projFilter, setProjFilter] = useState("all");
  const [selMonth, setSelMonth] = useState(-1); // -1 = all time

  const months = [];
  for(let i=0;i<12;i++){
    let m = now.getMonth()-i; let y=now.getFullYear();
    if(m<0){m+=12;y--;}
    months.push({m,y,label:["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][m]+" "+y,key:`${y}-${m}`});
  }

  const starred = pubItems.filter(x=>{
    if(!x.starred) return false;
    if(projFilter!=="all" && x.project!==projFilter) return false;
    if(selMonth!==-1){
      const mk = months.find(m=>m.key===String(selMonth));
      if(mk){
        const d = new Date(x.planned_date||x.updated_at||"");
        if(d.getMonth()!==mk.m || d.getFullYear()!==mk.y) return false;
      }
    }
    return true;
  });

  const activeProjs = projects.filter(p=>!p.archived);

  return(
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:10,fontWeight:800,color:"#6b7280",fontFamily:"monospace",letterSpacing:"1px"}}>★ ЗАЛЁТНЫЕ РИЛСЫ</span>
        <span style={{fontSize:10,color:"#f59e0b",fontFamily:"monospace",fontWeight:700}}>{starred.length} шт.</span>
        <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <select value={projFilter} onChange={e=>setProjFilter(e.target.value)}
            style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"4px 8px",borderRadius:6,fontSize:11,fontFamily:"inherit"}}>
            <option value="all">Все проекты</option>
            {activeProjs.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
            style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"4px 8px",borderRadius:6,fontSize:11,fontFamily:"inherit"}}>
            <option value={-1}>Всё время</option>
            {months.map(({label,key})=><option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>
      {starred.length===0?(
        <div style={{padding:"30px",textAlign:"center",color:"#4b5563",fontSize:11}}>Нет залётных рилсов за выбранный период</div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:1}}>
          {starred.map(item=>{
            const proj = projects.find(p=>p.id===item.project);
            return(
              <div key={item.id} style={{padding:"10px 14px",borderBottom:"1px solid #0d0d16",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{color:"#f59e0b",fontSize:16,flexShrink:0}}>★</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {proj&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"#1a1a2e",color:"#6b7280",border:"1px solid #2d2d44",fontFamily:"monospace"}}>{proj.label}</span>}
                    <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:"#1a1a2e",color:"#6b7280",border:"1px solid #2d2d44",fontFamily:"monospace"}}>{item.pub_type==="carousel"?"🖼 Карусель":"🎬 Видео/Рилс"}</span>
                    {item.planned_date&&<span style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>{item.planned_date.slice(0,10)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StarredReelsView;
