import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS, TABS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";

function CalendarView({projects, preItems, prodItems, postReels, postVideo, postCarousels, pubItems, adminItems, onOpenTask, onNewTask}) {
  const today = new Date();
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [view, setView] = useState("month"); // month | week
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);

  const typeColor = {pre:"#8b5cf6",prod:"#3b82f6",post_reels:"#ec4899",post_video:"#3b82f6",post_carousel:"#a78bfa",pub:"#10b981",admin:"#f97316"};
  const typeLabel = {pre:"Сцен",prod:"Съёмка",post_reels:"Рилс",post_video:"Видео",post_carousel:"Карусель",pub:"Публ",admin:"Адм"};

  const allTasks = [
    ...preItems.map(t=>({...t,_type:"pre",_date:t.deadline})),
    ...prodItems.map(t=>({...t,_type:"prod",_date:t.shoot_date||t.deadline})),
    ...postReels.map(t=>({...t,_type:"post_reels",_date:t.post_deadline})),
    ...postVideo.map(t=>({...t,_type:"post_video",_date:t.post_deadline})),
    ...postCarousels.map(t=>({...t,_type:"post_carousel",_date:t.post_deadline})),
    ...pubItems.map(t=>({...t,_type:"pub",_date:t.planned_date})),
    ...adminItems.map(t=>({...t,_type:"admin",_date:t.deadline})),
  ].filter(t=>t._date && !t.archived);

  function tasksForDate(dateStr) {
    return allTasks.filter(t => t._date === dateStr);
  }
  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function fmtMonthYear(y,m) {
    return new Date(y,m,1).toLocaleString("ru",{month:"long",year:"numeric"});
  }

  // Month view
  function monthDays() {
    const first = new Date(curYear, curMonth, 1);
    const last = new Date(curYear, curMonth+1, 0);
    const startDow = (first.getDay()+6)%7; // Mon=0
    const days = [];
    for (let i=0; i<startDow; i++) {
      const d = new Date(curYear, curMonth, -startDow+i+1);
      days.push({date:d, cur:false});
    }
    for (let i=1; i<=last.getDate(); i++) days.push({date:new Date(curYear,curMonth,i), cur:true});
    while (days.length % 7 !== 0) {
      const d = new Date(curYear, curMonth+1, days.length - last.getDate() - startDow + 1);
      days.push({date:d, cur:false});
    }
    return days;
  }

  // Week view
  function weekDays() {
    return Array.from({length:7},(_,i)=>{const d=new Date(weekStart); d.setDate(d.getDate()+i); return d;});
  }
  function prevWeek() { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }
  function nextWeek() { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }

  const todayStr = toDateStr(today);
  const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

  function DayCell({date, isCurMonth=true, compact=false}) {
    const ds = toDateStr(date);
    const tasks = tasksForDate(ds);
    const isToday = ds === todayStr;
    const proj = projects;
    const maxShow = compact ? 3 : 4;
    return (
      <div onClick={()=>{setSelectedDay(ds);setShowDayModal(true);}}
        style={{minHeight:compact?80:110,background:isToday?"#1a1a2e":"#0d0d16",border:"1px solid",borderColor:isToday?"#8b5cf6":"#1e1e2e",borderRadius:8,padding:"6px 7px",cursor:"pointer",opacity:isCurMonth?1:0.35,position:"relative",transition:"background 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=isToday?"#1e1e38":"#111118"}
        onMouseLeave={e=>e.currentTarget.style.background=isToday?"#1a1a2e":"#0d0d16"}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:13,fontWeight:isToday?800:500,color:isToday?"#8b5cf6":isCurMonth?"#f0eee8":"#4b5563",
            background:isToday?"#8b5cf620":"transparent",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {date.getDate()}
          </span>
          {tasks.length>0&&<span style={{fontSize:9,color:"#4b5563"}}>{tasks.length}</span>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          {tasks.slice(0,maxShow).map(t=>{
            const c = typeColor[t._type]||"#6b7280";
            const p = proj.find(p=>p.id===t.project);
            return <div key={t.id} onClick={e=>{e.stopPropagation();onOpenTask(t._type,t);}}
              style={{background:c+"22",borderLeft:"2px solid "+c,borderRadius:"0 4px 4px 0",padding:"2px 5px",fontSize:10,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}}
              title={t.title||"Без названия"}>
              {t.title||"Без названия"}
            </div>;
          })}
          {tasks.length>maxShow&&<div style={{fontSize:9,color:"#4b5563",textAlign:"center"}}>+{tasks.length-maxShow} ещё</div>}
        </div>
      </div>
    );
  }

  // Day detail modal
  function DayModal() {
    if (!showDayModal||!selectedDay) return null;
    const tasks = tasksForDate(selectedDay);
    const d = new Date(selectedDay+"T12:00:00");
    const label = d.toLocaleString("ru",{weekday:"long",day:"numeric",month:"long"});
    return (
      <div style={{position:"fixed",inset:0,background:"#000a",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowDayModal(false)}>
        <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:14,padding:20,width:380,maxHeight:"70vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f0eee8",textTransform:"capitalize"}}>{label}</div>
            <button onClick={()=>setShowDayModal(false)} style={{background:"transparent",border:"none",color:"#6b7280",cursor:"pointer",fontSize:18}}>×</button>
          </div>
          {tasks.length===0&&<div style={{textAlign:"center",color:"#4b5563",padding:"20px 0",fontSize:12}}>Нет задач на этот день</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {tasks.map(t=>{
              const c = typeColor[t._type]||"#6b7280";
              const p = projects.find(p=>p.id===t.project);
              return <div key={t.id} onClick={()=>{onOpenTask(t._type,t);setShowDayModal(false);}}
                style={{background:c+"15",border:"1px solid "+c+"40",borderRadius:8,padding:"10px 12px",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=c+"25"}
                onMouseLeave={e=>e.currentTarget.style.background=c+"15"}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:9,background:c+"30",color:c,borderRadius:4,padding:"1px 6px",fontWeight:700}}>{typeLabel[t._type]}</span>
                  {p&&<span style={{fontSize:9,color:p.color,background:p.color+"20",borderRadius:4,padding:"1px 6px"}}>{p.label}</span>}
                </div>
                <div style={{fontSize:13,color:"#f0eee8",fontWeight:600}}>{t.title||"Без названия"}</div>
              </div>;
            })}
          </div>
          <button onClick={()=>{onNewTask(selectedDay);setShowDayModal(false);}}
            style={{width:"100%",marginTop:14,background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",border:"none",borderRadius:8,padding:"9px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
            + Новая задача на этот день
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden",background:"#0a0a0f"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",borderBottom:"1px solid #1e1e2e",flexShrink:0,background:"#0d0d16"}}>
        {/* View toggle */}
        <div style={{display:"flex",background:"#16161f",borderRadius:8,padding:2}}>
          {[["month","Месяц"],["week","Неделя"]].map(([v,l])=>
            <button key={v} onClick={()=>setView(v)} style={{padding:"4px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:view===v?700:400,background:view===v?"#8b5cf6":"transparent",color:view===v?"#fff":"#6b7280",fontFamily:"inherit"}}>{l}</button>
          )}
        </div>
        {/* Nav */}
        <button onClick={()=>view==="month"?(curMonth===0?(setCurMonth(11),setCurYear(y=>y-1)):setCurMonth(m=>m-1)):prevWeek()}
          style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:13}}>‹</button>
        <div style={{fontSize:14,fontWeight:700,color:"#f0eee8",minWidth:180,textAlign:"center",textTransform:"capitalize"}}>
          {view==="month" ? fmtMonthYear(curYear,curMonth) : (()=>{const e=new Date(weekStart);e.setDate(e.getDate()+6);return weekStart.toLocaleString("ru",{day:"numeric",month:"short"})+" — "+e.toLocaleString("ru",{day:"numeric",month:"short",year:"numeric"});})()}
        </div>
        <button onClick={()=>view==="month"?(curMonth===11?(setCurMonth(0),setCurYear(y=>y+1)):setCurMonth(m=>m+1)):nextWeek()}
          style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:13}}>›</button>
        <button onClick={()=>{
          if(view==="month"){setCurYear(today.getFullYear());setCurMonth(today.getMonth());}
          else{const d=new Date(today);d.setDate(d.getDate()-d.getDay()+1);d.setHours(0,0,0,0);setWeekStart(d);}
        }} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"4px 12px",color:"#9ca3af",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Сегодня</button>
        <div style={{marginLeft:"auto",display:"flex",gap:10,flexWrap:"wrap"}}>
          {Object.entries(typeColor).map(([t,c])=><span key={t} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#6b7280"}}>
            <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{typeLabel[t]}
          </span>)}
        </div>
      </div>

      {/* Month view */}
      {view==="month"&&<div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
          {DOW.map(d=><div key={d} style={{textAlign:"center",fontSize:10,color:"#4b5563",fontWeight:700,padding:"4px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {monthDays().map((d,i)=><DayCell key={i} date={d.date} isCurMonth={d.cur}/>)}
        </div>
      </div>}

      {/* Week view */}
      {view==="week"&&<div style={{flex:1,overflow:"auto",padding:"12px 16px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
          {weekDays().map((d,i)=>{
            const ds = toDateStr(d);
            const isToday = ds===todayStr;
            return <div key={i}>
              <div style={{textAlign:"center",marginBottom:6}}>
                <div style={{fontSize:10,color:"#4b5563",fontWeight:700}}>{DOW[i]}</div>
                <div style={{fontSize:18,fontWeight:800,color:isToday?"#8b5cf6":"#f0eee8",
                  background:isToday?"#8b5cf620":"transparent",borderRadius:"50%",width:32,height:32,
                  display:"flex",alignItems:"center",justifyContent:"center",margin:"2px auto"}}>
                  {d.getDate()}
                </div>
              </div>
              <DayCell date={d} isCurMonth={true} compact={false}/>
            </div>;
          })}
        </div>
      </div>}

      <DayModal/>
    </div>
  );
}

export default CalendarView;
