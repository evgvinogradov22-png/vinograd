import React, { useState } from "react";
import RU_HOLIDAYS from "../../holidays";
import { MONTHS, WDAYS, PUB_STATUSES } from "../../constants";
import { stColor } from "../../utils/helpers";

function Kanban({statuses,items,renderCard,onDrop,onAddClick}){
  const [dragId,setDragId]=useState(null);
  const [overSt,setOverSt]=useState(null);
  return(
    <div style={{display:"flex",gap:10,overflowX:"auto",alignItems:"flex-start",paddingBottom:8}}>
      {statuses.map(st=>{
        const col=items.filter(x=>x.status===st.id);
        return <div key={st.id}
          onDragOver={e=>{e.preventDefault();setOverSt(st.id);}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverSt(null);}}
          onDrop={e=>{e.preventDefault();if(dragId){onDrop(dragId,st.id);setDragId(null);setOverSt(null);}}}
          style={{minWidth:280,width:280,background:overSt===st.id?"#111120":"#0d0d16",border:`1px solid ${overSt===st.id?st.c+"70":"#1e1e2e"}`,borderRadius:12,padding:"10px 8px",flexShrink:0,transition:"all 0.12s"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"0 2px"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:st.c}}/>
            <span style={{fontSize:10,fontWeight:700,color:st.c,fontFamily:"monospace"}}>{st.l}</span>
            <span style={{fontSize:9,background:st.c+"20",color:st.c,borderRadius:10,padding:"0 6px",fontFamily:"monospace"}}>{col.length}</span>
            <button onClick={()=>onAddClick(st.id)} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${st.c}40`,borderRadius:6,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",color:st.c,cursor:"pointer",fontSize:14,lineHeight:1,padding:0}}>+</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {col.map(item=>(
              <div key={item.id} draggable onDragStart={()=>setDragId(item.id)} style={{cursor:"grab",userSelect:"none"}}>{renderCard(item)}</div>
            ))}
          </div>
        </div>;
      })}
    </div>
  );
}

function CalView({items,dateField,onDayClick,renderChip,color,onMoveToDay}){
  const _now=new Date();
  const [y,setY]=useState(_now.getFullYear()); const [m,setM]=useState(_now.getMonth());
  const [dragId,setDragId]=useState(null);
  const today=new Date(); const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const days=dim(y,m); const first=fd(y,m);
  const byDay={};
  items.forEach(x=>{const df=x[dateField];if(df){const dk=df.slice(0,10);(byDay[dk]=byDay[dk]||[]).push(x);}});
  const dk=d=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const [overDay,setOverDay]=useState(null);
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button onClick={()=>m===0?(setM(11),setY(y=>y-1)):setM(m=>m-1)} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>‹</button>
        <h3 style={{fontSize:15,fontWeight:800,margin:0}}>{MONTHS[m]} <span style={{color:"#9ca3af"}}>{y}</span></h3>
        <button onClick={()=>m===11?(setM(0),setY(y=>y+1)):setM(m=>m+1)} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
        {WDAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#9ca3af",fontFamily:"monospace",padding:"2px 0",fontWeight:700}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array.from({length:first}).map((_,i)=><div key={"e"+i} style={{minHeight:74}}/>)}
        {Array.from({length:days},(_,i)=>i+1).map(day=>{
          const k=dk(day); const its=byDay[k]||[]; const isToday=k===todayStr; const isOver=overDay===k;
          return <div key={day}
            onDragOver={e=>{e.preventDefault();setOverDay(k);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverDay(null);}}
            onDrop={e=>{e.preventDefault();if(dragId){onMoveToDay(dragId,k);setDragId(null);setOverDay(null);}}}
            onClick={()=>onDayClick(k)}
            style={{minHeight:74,background:isOver?"#111130":isToday?"#0f0f1e":"#111118",border:isOver?`1px solid ${color}`:isToday?`1px solid ${color}`:"1px solid #1e1e2e",borderRadius:6,padding:"4px 4px 3px",cursor:"pointer",transition:"all 0.1s"}}
            onMouseEnter={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor=color+"50";}}
            onMouseLeave={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#1e1e2e";}}>
            <div style={{fontSize:9,color:isToday||isOver?color:"#9ca3af",fontWeight:isToday?800:400,marginBottom:2,fontFamily:"monospace"}}>{day}</div>
            {its.slice(0,2).map(x=>(
              <div key={x.id} draggable onDragStart={e=>{e.stopPropagation();setDragId(x.id);}} style={{cursor:"grab",userSelect:"none"}}>
                {renderChip(x)}
              </div>
            ))}
            {its.length>2&&<div style={{fontSize:8,color:"#9ca3af"}}>+{its.length-2}</div>}
          </div>;
        })}
      </div>
    </div>
  );
}

function WeekView({items,onItemClick,onDayClick,projects,onMoveToDay,onToggleStar}){
  const [base,setBase]=useState(()=>{const d=new Date();const dow=d.getDay();d.setDate(d.getDate()-(dow===0?6:dow-1));d.setHours(0,0,0,0);return d;});
  const [dragId,setDragId]=useState(null); const [overDay,setOverDay]=useState(null);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(d.getDate()+i);return d;});
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const byDay={};items.forEach(x=>{if(x.planned_date){const k=x.planned_date.slice(0,10);(byDay[k]=byDay[k]||[]).push(x);}});
  const todayStr=fmt(new Date());
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={()=>{const d=new Date(base);d.setDate(d.getDate()-7);setBase(d);}} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>‹</button>
        <span style={{fontSize:13,fontWeight:700}}>{days[0].getDate()} {MONTHS[days[0].getMonth()]} — {days[6].getDate()} {MONTHS[days[6].getMonth()]} {days[0].getFullYear()}</span>
        <button onClick={()=>{const d=new Date(base);d.setDate(d.getDate()+7);setBase(d);}} style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",width:28,height:28,borderRadius:6,cursor:"pointer",fontSize:14}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:2,overflow:"hidden",width:"100%"}}>
        {days.map(d=>{
          const k=fmt(d); const its=byDay[k]||[]; const isToday=k===todayStr; const isOver=overDay===k;
          return <div key={k}
            onDragOver={e=>{e.preventDefault();setOverDay(k);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOverDay(null);}}
            onDrop={e=>{e.preventDefault();if(dragId){onMoveToDay(dragId,k+"T12:00");setDragId(null);setOverDay(null);}}}
            onClick={()=>onDayClick(k+"T12:00")}
            style={{background:isOver?"#111130":isToday?"#0f0f1e":"#111118",border:isOver?"1px solid #7c3aed":isToday?"1px solid #7c3aed":"1px solid #1e1e2e",borderRadius:7,padding:"5px 4px",minHeight:115,cursor:"pointer",transition:"all 0.1s",overflow:"hidden"}}
            onMouseEnter={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#3d3d5c";}}
            onMouseLeave={e=>{if(!isOver&&!isToday)e.currentTarget.style.borderColor="#1e1e2e";}}>
            <div style={{textAlign:"center",marginBottom:6}}>
              <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace"}}>{WDAYS[days.indexOf(d)]}</div>
              <div style={{fontSize:15,fontWeight:800,color:isToday?"#a78bfa":"#f0eee8"}}>{d.getDate()}</div>
              {(()=>{const mm=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");const h=RU_HOLIDAYS[`${mm}-${dd}`];return h?<div style={{fontSize:7,color:"#f59e0b",fontFamily:"monospace",marginTop:2,lineHeight:1.3,padding:"1px 3px",background:"#f59e0b10",borderRadius:3}}>{h}</div>:null;})()}
            </div>
            {its.map(x=>{
              const sc=stColor(PUB_STATUSES,x.status);
              const st=PUB_STATUSES.find(s=>s.id===x.status);
              const proj=projects.find(p=>p.id===x.project);
              const bg=sc+"18";
              const border=sc+"50";
              return(
              <div key={x.id} draggable
                onDragStart={e=>{e.stopPropagation();setDragId(x.id);}}
                onDragEnd={()=>setDragId(null)}
                onClick={e=>{e.stopPropagation();if(!dragId)onItemClick(x);}}
                style={{background:bg,border:`1px solid ${border}`,borderRadius:4,padding:"4px 5px",marginBottom:3,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:3,marginBottom:3}}>
                  <div style={{fontSize:8,fontWeight:700,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,lineHeight:1.3}}>{x.title||"Без названия"}</div>
                  <span style={{fontSize:11,color:x.starred?"#f59e0b":"#2d2d44",flexShrink:0,lineHeight:1,cursor:"pointer"}}
                    onClick={e=>{e.stopPropagation();e.preventDefault();if(onToggleStar)onToggleStar(x);else onItemClick({...x,_toggleStar:true});}}>★</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
                  {proj&&<span style={{fontSize:6,color:proj.color,fontFamily:"monospace",background:proj.color+"18",borderRadius:2,padding:"1px 3px",maxWidth:55,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj.label}</span>}
                  {st&&<span style={{fontSize:6,color:sc,fontFamily:"monospace",background:sc+"18",borderRadius:2,padding:"1px 3px"}}>{st.l}</span>}
                  <span style={{fontSize:7,color:"#6b7280",marginLeft:"auto"}}>{x.pub_type==="carousel"?"🖼":`🎬${(x.reels_count||1)>1?" ×"+(x.reels_count||1):""}`}</span>
                </div>
              </div>
            );})}
          </div>;
        })}
      </div>
    </div>
  );
}


export { Kanban, CalView, WeekView };
