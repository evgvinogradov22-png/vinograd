import React, { useState, useRef, useEffect, useCallback } from "react";
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

function ContentPlanView({projects}) {
  const today = new Date();
  const [selYear,  setSelYear]  = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const [showPast, setShowPast] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load from server
  useEffect(() => {
    setLoading(true);
    fetch(`/api/content-plan?year=${selYear}&month=${selMonth}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRows(data.map(r => ({...r, days: typeof r.days === "string" ? JSON.parse(r.days) : (r.days||{})})));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selYear, selMonth]);

  async function addRow(projId) {
    const id = Math.random().toString(36).slice(2,9);
    const row = {id, proj_id: projId, year: selYear, month: selMonth, type: "Рилс", days: {}, sort_order: rows.filter(r=>r.proj_id===projId).length};
    setRows(p => [...p, row]);
    await fetch("/api/content-plan", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(row)});
  }

  async function deleteRow(id) {
    setRows(p => p.filter(r => r.id !== id));
    await fetch(`/api/content-plan/${id}`, {method:"DELETE"});
  }

  async function updateType(id, type) {
    setRows(p => p.map(r => r.id===id ? {...r, type} : r));
    await fetch(`/api/content-plan/${id}`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({type})});
  }

  async function updateDay(id, day, value) {
    const num = parseInt(value) || 0;
    setRows(p => p.map(r => {
      if (r.id !== id) return r;
      const days = {...r.days};
      if (num > 0) days[day] = num; else delete days[day];
      return {...r, days};
    }));
    const row = rows.find(r => r.id === id);
    if (!row) return;
    const days = {...row.days};
    if (num > 0) days[day] = num; else delete days[day];
    await fetch(`/api/content-plan/${id}`, {method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({days})});
  }

  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const allDays = Array.from({length: daysInMonth}, (_, i) => i + 1);
  const todayDay = (today.getFullYear()===selYear && today.getMonth()+1===selMonth) ? today.getDate() : null;
  const visibleDays = allDays.filter(d => showPast || !todayDay || d >= Math.max(1, todayDay - 2));

  const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  function prevMonth() { if(selMonth===1){setSelMonth(12);setSelYear(y=>y-1);}else setSelMonth(m=>m-1); }
  function nextMonth() { if(selMonth===12){setSelMonth(1);setSelYear(y=>y+1);}else setSelMonth(m=>m+1); }

  const activeProjects = projects.filter(p => !p.archived);

  const TH = {background:"#111118",color:"#6b7280",fontSize:9,fontFamily:"monospace",fontWeight:700,
    padding:"6px 5px",borderRight:"1px solid #1e1e2e",borderBottom:"2px solid #2d2d44",
    textAlign:"center",whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2};
  const TD = {padding:"4px 5px",borderRight:"1px solid #0d0d16",borderBottom:"1px solid #111118",
    fontSize:11,textAlign:"center",whiteSpace:"nowrap",verticalAlign:"middle"};
  const noSpinner = {MozAppearance:"textfield",WebkitAppearance:"none"};

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:"#0a0a0f",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",borderBottom:"1px solid #1e1e2e",flexShrink:0,background:"#0d0d16"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#f0eee8"}}>📋 Контент-план</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:12}}>
          <button onClick={prevMonth} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"3px 10px",color:"#9ca3af",cursor:"pointer",fontSize:14}}>‹</button>
          <div style={{fontSize:13,fontWeight:700,color:"#f0eee8",minWidth:140,textAlign:"center"}}>{MONTHS[selMonth-1]} {selYear}</div>
          <button onClick={nextMonth} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"3px 10px",color:"#9ca3af",cursor:"pointer",fontSize:14}}>›</button>
        </div>
        <button onClick={()=>{setSelYear(today.getFullYear());setSelMonth(today.getMonth()+1);}}
          style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"3px 10px",color:"#9ca3af",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Сегодня</button>
        <button onClick={()=>setShowPast(p=>!p)}
          style={{background:showPast?"#ffffff15":"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"3px 12px",color:showPast?"#f0eee8":"#6b7280",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
          {showPast?"Скрыть прошлое":"Показать всё"}
        </button>
        {loading && <div style={{fontSize:10,color:"#4b5563",marginLeft:8}}>загрузка...</div>}
      </div>

      <div style={{flex:1,overflow:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"max-content",minWidth:"100%"}}>
          <thead>
            <tr>
              <th style={{...TH,textAlign:"left",minWidth:200,position:"sticky",left:0,zIndex:3}}>Проект / Тип</th>
              <th style={{...TH,minWidth:42,color:"#d1d5db"}}>Факт</th>
              {visibleDays.map(d=>(
                <th key={d} style={{...TH,minWidth:30,
                  color:d===todayDay?"#8b5cf6":"#4b5563",
                  background:d===todayDay?"#1a1a2e":"#111118",
                  borderBottom:d===todayDay?"2px solid #8b5cf6":"2px solid #2d2d44"}}>
                  {String(d).padStart(2,"0")}
                </th>
              ))}
              <th style={{...TH,minWidth:24,borderRight:"none"}}/>
            </tr>
          </thead>
          <tbody>
            {activeProjects.map(proj => {
              const projRows = rows.filter(r => r.proj_id === proj.id);
              const projFact = projRows.reduce((s,r)=>s+Object.values(r.days||{}).reduce((a,v)=>a+(v||0),0),0);
              return [
                <tr key={`ph_${proj.id}`} style={{background:"#111118"}}>
                  <td style={{...TD,textAlign:"left",position:"sticky",left:0,background:"#111118",zIndex:1,padding:"7px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:proj.color,flexShrink:0}}/>
                      <span style={{fontSize:11,fontWeight:800,color:proj.color,fontFamily:"monospace"}}>{proj.label.toUpperCase()}</span>
                      <button onClick={()=>addRow(proj.id)}
                        style={{marginLeft:"auto",background:proj.color+"20",border:"1px solid "+proj.color+"40",borderRadius:5,padding:"2px 8px",color:proj.color,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit"}}>+ строка</button>
                    </div>
                  </td>
                  <td style={{...TD,color:"#d1d5db",fontWeight:700,background:"#111118"}}>{projFact||""}</td>
                  {visibleDays.map(d=>{
                    const c=projRows.reduce((s,r)=>s+(r.days?.[d]||0),0);
                    return <td key={d} style={{...TD,background:d===todayDay?"#1a1a2e":"#111118",color:c>0?"#10b981":"#1e1e2e",fontWeight:800}}>{c>0?c:""}</td>;
                  })}
                  <td style={{...TD,background:"#111118"}}/>
                </tr>,
                ...projRows.map((r,i)=>{
                  const fact=Object.values(r.days||{}).reduce((a,v)=>a+(v||0),0);
                  const bg=i%2===0?"#0d0d16":"#0a0a14";
                  return (
                    <tr key={r.id} style={{background:bg}}
                      onMouseEnter={e=>e.currentTarget.style.background="#111118"}
                      onMouseLeave={e=>e.currentTarget.style.background=bg}>
                      <td style={{...TD,textAlign:"left",position:"sticky",left:0,background:"inherit",zIndex:1,padding:"3px 12px 3px 28px"}}>
                        <input value={r.type||""} onChange={e=>updateType(r.id,e.target.value)}
                          style={{background:"transparent",border:"none",color:"#9ca3af",fontSize:11,outline:"none",fontFamily:"inherit",width:"100%"}}
                          placeholder="Тип контента"/>
                      </td>
                      <td style={{...TD,color:"#d1d5db",fontWeight:700}}>{fact||""}</td>
                      {visibleDays.map(d=>{
                        const v=r.days?.[d]||0;
                        return <td key={d} style={{...TD,padding:"1px 2px",background:d===todayDay?(i%2===0?"#111128":"#0d0d20"):"inherit"}}>
                          <input value={v||""} onChange={e=>updateDay(r.id,d,e.target.value)}
                            style={{...noSpinner,width:26,background:"transparent",border:"none",
                              color:v>0?"#10b981":"#374151",fontSize:10,fontWeight:v>0?700:400,
                              textAlign:"center",outline:"none",fontFamily:"inherit"}}/>
                        </td>;
                      })}
                      <td style={{...TD,padding:"2px"}}>
                        <button onClick={()=>deleteRow(r.id)}
                          style={{background:"transparent",border:"none",color:"#2d2d44",cursor:"pointer",fontSize:14,lineHeight:1}}
                          onMouseEnter={e=>e.currentTarget.style.color="#ef4444"}
                          onMouseLeave={e=>e.currentTarget.style.color="#2d2d44"}>×</button>
                      </td>
                    </tr>
                  );
                }),
                <tr key={`sp_${proj.id}`}><td colSpan={3+visibleDays.length} style={{height:6,background:"#0a0a0f",borderBottom:"1px solid #1e1e2e"}}/></tr>
              ];
            })}

            {/* Grand total */}
            {(()=>{
              const gFact=rows.reduce((s,r)=>s+Object.values(r.days||{}).reduce((a,v)=>a+(v||0),0),0);
              const byDay={};
              rows.forEach(r=>Object.entries(r.days||{}).forEach(([d,v])=>{byDay[d]=(byDay[d]||0)+(v||0);}));
              return (
                <tr style={{background:"#111118",borderTop:"2px solid #2d2d44"}}>
                  <td style={{...TD,textAlign:"left",position:"sticky",left:0,background:"#111118",zIndex:1,fontWeight:800,color:"#f0eee8",fontSize:12,padding:"7px 12px"}}>ИТОГО</td>
                  <td style={{...TD,color:"#d1d5db",fontWeight:800,background:"#111118"}}>{gFact||""}</td>
                  {visibleDays.map(d=>{const c=byDay[d]||0;return(
                    <td key={d} style={{...TD,color:c>0?"#10b981":"#374151",fontWeight:c>0?800:400,background:d===todayDay?"#111128":"#111118"}}>{c>0?c:""}</td>
                  );})}
                  <td style={{...TD,background:"#111118"}}/>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsView({pubItems,projects,kpisData={}}){
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [kpis, setKpis] = useState(kpisData);
  const [kpiLoaded, setKpiLoaded] = useState(false);

  // Load KPIs from server once
  useEffect(()=>{
    fetch("/api/analytics/kpi").then(r=>r.ok?r.json():[]).then(rows=>{
      const map={...kpisData};
      rows.forEach(r=>{ map[`${r.project_id}_${r.year}_${r.month}`]=String(r.kpi); });
      setKpis(map); setKpiLoaded(true);
    }).catch(()=>setKpiLoaded(true));
  },[]);

  function kpiKey(projId) { return `${projId}_${selYear}_${selMonth}`; }
  function getKpi(projId) { return kpis[kpiKey(projId)]||""; }
  function setKpi(projId, val) {
    const key = kpiKey(projId);
    setKpis(p=>({...p,[key]:val}));
    // Debounced save
    clearTimeout(window._kpiTimer);
    window._kpiTimer = setTimeout(()=>{
      fetch("/api/analytics/kpi",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({project_id:projId,month:selMonth,year:selYear,kpi:parseInt(val)||0})
      }).catch(()=>{});
    }, 800);
  }

  // Build list of months (last 12)
  const months = [];
  for(let i=0;i<12;i++){
    let m = now.getMonth()-i; let y=now.getFullYear();
    if(m<0){m+=12;y--;}
    months.push({m,y,label:["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][m]+" "+y});
  }

  // Filter published items (including archived) for selected month
  const published = pubItems.filter(x=>{
    if(x.status!=="published") return false;
    const d = x.planned_date||x.updated_at||"";
    if(!d) return false;
    const dt = new Date(d);
    return dt.getMonth()===selMonth && dt.getFullYear()===selYear;
  });

  const activeProjs = projects.filter(p=>!p.archived);

  // Count by project and type
  function count(projId, type) {
    return published.filter(x=>x.project===projId && (type==="video"?(x.pub_type!=="carousel"):(x.pub_type==="carousel"))).reduce((s,x)=>s+pubCount(x),0);
  }
  function total(projId) { return published.filter(x=>x.project===projId).reduce((s,x)=>s+pubCount(x),0); }

  const totalVideo = published.filter(x=>x.pub_type!=="carousel").reduce((s,x)=>s+pubCount(x),0);
  const totalCarousel = published.filter(x=>x.pub_type==="carousel").reduce((s,x)=>s+pubCount(x),0);
  const totalAll = published.reduce((s,x)=>s+pubCount(x),0);
  const totalKpi = projects.filter(p=>!p.archived).reduce((a,p)=>a+(parseInt(getKpi(p.id))||0),0);

  const pctColor = p => p>=100?"#10b981":p>=60?"#f59e0b":"#ef4444";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Фильтр месяца */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#6b7280",fontFamily:"monospace",fontWeight:700}}>ПЕРИОД</span>
        <select value={`${selYear}-${selMonth}`} onChange={e=>{const[y,m]=e.target.value.split("-");setSelYear(Number(y));setSelMonth(Number(m));}}
          style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"5px 10px",borderRadius:7,fontSize:12,fontFamily:"inherit"}}>
          {months.map(({m,y,label})=><option key={`${y}-${m}`} value={`${y}-${m}`}>{label}</option>)}
        </select>
        <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{totalAll} публикаций за период</span>
      </div>

      {/* Таблица */}
      <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:12,overflow:"hidden"}}>
        <div style={{fontSize:10,fontWeight:800,color:"#6b7280",fontFamily:"monospace",padding:"12px 16px",borderBottom:"1px solid #1e1e2e",letterSpacing:"1px"}}>
          ПУБЛИКАЦИИ ПО ПРОЕКТАМ
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#0a0a0f"}}>
              <th style={{padding:"8px 16px",textAlign:"left",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>ПРОЕКТ</th>
              <th style={{padding:"8px 16px",textAlign:"center",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>🎬 ВИДЕО / РИЛС</th>
              <th style={{padding:"8px 16px",textAlign:"center",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>🖼 КАРУСЕЛЬ</th>
              <th style={{padding:"8px 16px",textAlign:"center",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>ВСЕГО</th>
              <th style={{padding:"8px 16px",textAlign:"left",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>KPI ПЛАН</th>
              <th style={{padding:"8px 16px",textAlign:"left",fontSize:9,fontFamily:"monospace",color:"#4b5563",fontWeight:700,borderBottom:"1px solid #1e1e2e"}}>ВЫПОЛНЕНИЕ</th>
            </tr>
          </thead>
          <tbody>
            {activeProjs.map(proj=>{
              const v = count(proj.id,"video");
              const c = count(proj.id,"carousel");
              const tot = total(proj.id);
              const kpi = parseInt(getKpi(proj.id))||0;
              const pct = kpi>0?Math.min(100,Math.round(tot/kpi*100)):0;
              const pc = pctColor(pct);
              return (
                <tr key={proj.id} style={{borderBottom:"1px solid #0d0d16"}}
                  onMouseEnter={e=>{Array.from(e.currentTarget.cells).forEach(c=>c.style.background="#111118");}}
                  onMouseLeave={e=>{Array.from(e.currentTarget.cells).forEach(c=>c.style.background="");}}>
                  <td style={{padding:"10px 16px",color:"#d1d5db"}}>{proj.label}</td>
                  <td style={{padding:"10px 16px",textAlign:"center"}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:v>0?"#f0eee8":"#2d2d44"}}>{v}</span>
                  </td>
                  <td style={{padding:"10px 16px",textAlign:"center"}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:c>0?"#f0eee8":"#2d2d44"}}>{c}</span>
                  </td>
                  <td style={{padding:"10px 16px",textAlign:"center"}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:tot>0?"#f0eee8":"#2d2d44"}}>{tot}</span>
                  </td>
                  <td style={{padding:"10px 16px"}}>
                    <input type="number" min="0" value={getKpi(proj.id)} onChange={e=>setKpi(proj.id, e.target.value)}
                      placeholder="—"
                      style={{background:"#111118",border:"1px solid #2d2d44",color:"#f0eee8",padding:"4px 8px",borderRadius:5,fontSize:12,width:60,textAlign:"center",fontFamily:"monospace",outline:"none"}}/>
                  </td>
                  <td style={{padding:"10px 16px"}}>
                    {kpi>0?(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:5,background:"#1a1a2e",borderRadius:3,overflow:"hidden",minWidth:60}}>
                          <div style={{width:pct+"%",height:"100%",background:pc,borderRadius:3,transition:"width 0.3s"}}/>
                        </div>
                        <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:pc,minWidth:34,textAlign:"right"}}>{pct}%</span>
                      </div>
                    ):<span style={{fontSize:10,color:"#2d2d44",fontFamily:"monospace"}}>—</span>}
                  </td>
                </tr>
              );
            })}
            {/* Итого */}
            <tr style={{background:"#0a0a0f",borderTop:"1px solid #2d2d44"}}>
              <td style={{padding:"10px 16px",fontWeight:700,color:"#f0eee8",fontSize:11,fontFamily:"monospace"}}>ИТОГО</td>
              <td style={{padding:"10px 16px",textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:totalVideo>0?"#f0eee8":"#2d2d44"}}>{totalVideo}</span>
              </td>
              <td style={{padding:"10px 16px",textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:totalCarousel>0?"#f0eee8":"#2d2d44"}}>{totalCarousel}</span>
              </td>
              <td style={{padding:"10px 16px",textAlign:"center"}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:totalAll>0?"#10b981":"#2d2d44"}}>{totalAll}</span>
              </td>
              <td style={{padding:"10px 16px"}}>
                <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{totalKpi>0?"план: "+totalKpi:""}</span>
              </td>
              <td style={{padding:"10px 16px"}}>
                {totalKpi>0&&<span style={{fontSize:10,fontFamily:"monospace",fontWeight:700,color:pctColor(Math.round(totalAll/totalKpi*100))}}>
                  {Math.min(100,Math.round(totalAll/totalKpi*100))}%
                </span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Залётные рилсы */}
      <StarredReelsView pubItems={pubItems} projects={projects}/>
    </div>
  );
}

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

function BaseProjectsView({projects=[], setProjects}) {
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");

  const COLORS = ["#8b5cf6","#3b82f6","#ec4899","#10b981","#f59e0b","#f97316","#06b6d4","#a78bfa","#ef4444","#14b8a6"];

  async function addProject() {
    if (!newLabel.trim()) return;
    const id = "proj_" + Math.random().toString(36).slice(2,9);
    const proj = {id, label: newLabel.trim(), color: newColor, description: "", links: [], archived: false};
    try {
      await api.createProject(proj);
      setProjects(p => [...p, proj]);
      setNewLabel(""); setAdding(false);
    } catch(e) { alert("Ошибка: " + e.message); }
  }

  const active = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);
  const shown = showArchived ? archived : active;

  return (
    <div style={{padding:"4px 0"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{fontSize:11,color:"#4b5563"}}>{active.length} активных проектов</div>
        <button onClick={()=>setShowArchived(p=>!p)} style={{marginLeft:"auto",background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"4px 12px",color:"#6b7280",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
          {showArchived ? "← Активные" : "🗄 Архив ("+archived.length+")"}
        </button>
        {!showArchived && <button onClick={()=>setAdding(true)} style={{background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:7,padding:"5px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Проект</button>}
      </div>

      {adding && (
        <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:10,padding:14,marginBottom:14}}>
          <div style={{fontSize:10,color:"#6b7280",fontFamily:"monospace",marginBottom:8}}>НОВЫЙ ПРОЕКТ</div>
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()}
            placeholder="Название проекта" autoFocus
            style={{background:"#0d0d16",border:"1px solid #2d2d44",borderRadius:7,padding:"7px 10px",color:"#f0eee8",fontSize:13,outline:"none",width:"100%",marginBottom:10,boxSizing:"border-box",fontFamily:"inherit"}}/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {COLORS.map(c=>(
              <button key={c} onClick={()=>setNewColor(c)} style={{width:22,height:22,borderRadius:"50%",background:c,border:newColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer",padding:0}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setAdding(false);setNewLabel("");}} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"7px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Отмена</button>
            <button onClick={addProject} style={{flex:2,background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:7,padding:"7px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12}}>Добавить</button>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {shown.map(proj => <ProjectCard key={proj.id} proj={proj} showArchive={showArchived} setProjects={setProjects}/>)}
        {shown.length===0 && <div style={{color:"#4b5563",fontSize:12,padding:"20px 0"}}>{showArchived?"Нет архивных проектов":"Нет активных проектов"}</div>}
      </div>
    </div>
  );
}

function BaseView({projects,setProjects,teamMembers,setTeamMembers,currentUser}){
  const [subTab,setSubTab]=useState("projects");
  const tabs=[
    {id:"projects",label:"📁 Проекты"},
    {id:"team",label:"👥 Команда"},
    {id:"training",label:"📚 Обучение"},
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",gap:6,borderBottom:"1px solid #1e1e2e",paddingBottom:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"7px 16px",borderRadius:"8px 8px 0 0",cursor:"pointer",background:subTab===t.id?"#111118":"transparent",border:subTab===t.id?"1px solid #2d2d44":"1px solid transparent",borderBottom:subTab===t.id?"1px solid #111118":"none",color:subTab===t.id?"#f0eee8":"#6b7280",fontSize:12,fontFamily:"inherit",fontWeight:subTab===t.id?700:400,marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab==="projects"&&<BaseProjectsView projects={projects} setProjects={setProjects}/>}
      {subTab==="team"&&<TeamView teamMembers={teamMembers} setTeamMembers={setTeamMembers} currentUser={currentUser}/>}
      {subTab==="training"&&<TrainingView/>}
    </div>
  );
}

function TrainingView(){
  const [items,setItems]=useState([]);
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({title:"",url:"",description:"",category:""});
  const u=(k,v)=>setForm(p=>({...p,[k]:v}));
  const categories=["Монтаж","Съёмка","Сценарий","SMM","Дизайн","Другое"];

  useEffect(()=>{
    fetch("/api/training").then(r=>r.ok?r.json():[]).then(setItems).catch(()=>{});
  },[]);

  async function add(){
    if(!form.title.trim()) return;
    try{
      const r=await fetch("/api/training",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(r.ok){const item=await r.json();setItems(p=>[...p,item]);}
      setForm({title:"",url:"",description:"",category:""});setAdding(false);
    }catch(e){alert("Ошибка: "+e.message);}
  }
  async function remove(id){
    await fetch("/api/training/"+id,{method:"DELETE"}).catch(()=>{});
    setItems(p=>p.filter(x=>x.id!==id));
  }

  const grouped={};
  items.forEach(x=>{const c=x.category||"Другое";(grouped[c]=grouped[c]||[]).push(x);});

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>setAdding(true)} style={{background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>+ Добавить материал</button>
      </div>

      {adding&&(
        <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:12,padding:"16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{fontSize:12,fontWeight:700,color:"#06b6d4",marginBottom:2}}>+ Новый материал</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="НАЗВАНИЕ"><input value={form.title} onChange={e=>u("title",e.target.value)} placeholder="Название материала" style={SI}/></Field>
            <Field label="КАТЕГОРИЯ"><select value={form.category} onChange={e=>u("category",e.target.value)} style={SI}>
              <option value="">— выберите —</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select></Field>
          </div>
          <Field label="ССЫЛКА"><input value={form.url} onChange={e=>u("url",e.target.value)} placeholder="https://..." style={SI}/></Field>
          <Field label="ОПИСАНИЕ"><textarea value={form.description} onChange={e=>u("description",e.target.value)} placeholder="Краткое описание..." style={{...SI,minHeight:60,resize:"vertical"}}/></Field>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setAdding(false)} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
            <button onClick={add} style={{flex:2,background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Добавить</button>
          </div>
        </div>
      )}

      {items.length===0&&!adding&&(
        <div style={{textAlign:"center",padding:"50px 0",color:"#4b5563"}}>
          <div style={{fontSize:36,marginBottom:8}}>📚</div>
          <div style={{fontSize:12}}>Добавьте обучающие материалы</div>
        </div>
      )}

      {Object.entries(grouped).map(([cat,catItems])=>(
        <div key={cat}>
          <div style={{fontSize:10,fontWeight:800,color:"#6b7280",fontFamily:"monospace",marginBottom:8,letterSpacing:"0.05em"}}>{cat.toUpperCase()}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {catItems.map(item=>(
              <div key={item.id} style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{item.title}</div>
                    {item.description&&<div style={{fontSize:11,color:"#6b7280",lineHeight:1.4}}>{item.description}</div>}
                  </div>
                  <button onClick={()=>remove(item.id)} style={{background:"transparent",border:"none",color:"#2d2d44",cursor:"pointer",fontSize:14,flexShrink:0,padding:0}} onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#2d2d44"}>×</button>
                </div>
                {item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#06b6d4",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {item.url}</a>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({proj, showArchive, setProjects}){
  const [nl,setNl]=useState("");
  return <div style={{background:"#111118",border:'1px solid #1e1e2e',borderTop:'3px solid #2d2d44',borderRadius:12,padding:"14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
<div style={{width:34,height:34,borderRadius:9,background:proj.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{(proj.label||"?")[0]}</div>
            <input value={proj.label} onChange={e=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,label:e.target.value}:x))} onBlur={e=>api.updateProject(proj.id,{label:e.target.value}).catch(()=>{})} style={{...SI,flex:1,padding:"4px 8px",fontSize:13,fontWeight:700}}/>
            <button onClick={async()=>{ const v=!proj.archived; await api.updateProject(proj.id,{archived:v}); setProjects(p=>p.map(x=>x.id===proj.id?{...x,archived:v}:x)); }} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"4px 8px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>{showArchive?"↩":"🗄"}</button>
            <button onClick={async()=>{if(!window.confirm("Удалить проект «"+proj.label+"»? Это действие нельзя отменить.")) return; try{await api.deleteProject(proj.id);setProjects(p=>p.filter(x=>x.id!==proj.id));}catch(e){alert("Ошибка: "+e.message);}}} style={{background:"transparent",border:"1px solid #ef444440",borderRadius:6,padding:"4px 8px",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑</button>
          </div>
          <textarea value={proj.description} onChange={e=>setProjects(p=>p.map(x=>x.id===proj.id?{...x,description:e.target.value}:x))} onBlur={e=>api.updateProject(proj.id,{description:e.target.value}).catch(()=>{})} placeholder="Описание проекта..." style={{...SI,minHeight:60,resize:"vertical",lineHeight:1.5,marginBottom:8,fontSize:11}}/>

          
        </div>;
}

function TeamView({teamMembers,setTeamMembers,currentUser}){
  const isDirector = currentUser?.role==="Директор";
  const [adding,setAdding]=useState(false);
  const [newM,setNewM]=useState({name:"",role:ROLES_LIST[0],telegram:"",color:"#8b5cf6",note:""});
  async function addMember(){
    if(!newM.name.trim()) return;
    try {
      const created = await api.register({...newM, password: "vinogradov", invite_password: "vinograd2026"});
      setTeamMembers(p=>[...p,{...created, note:""}]);
      setNewM({name:"",role:ROLES_LIST[0],telegram:"",color:"#8b5cf6",note:""});
      setAdding(false);
    } catch(e){ alert("Ошибка добавления: "+e.message); }
  }
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <h2 style={{fontSize:17,fontWeight:800,margin:0,color:"#06b6d4"}}>👥 Команда</h2>
      {isDirector&&<button onClick={()=>setAdding(true)} style={{marginLeft:"auto",background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Добавить сотрудника</button>}
    </div>
    {adding&&<div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:12,padding:"16px",marginBottom:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <Field label="ИМЯ"><input value={newM.name} onChange={e=>setNewM(p=>({...p,name:e.target.value}))} placeholder="Имя Фамилия" style={SI}/></Field>
        <Field label="ДОЛЖНОСТЬ"><select value={newM.role} onChange={e=>setNewM(p=>({...p,role:e.target.value}))} style={SI}>{ROLES_LIST.map(r=><option key={r} value={r}>{r}</option>)}</select></Field>
        <Field label="TELEGRAM"><input value={newM.telegram} onChange={e=>setNewM(p=>({...p,telegram:e.target.value}))} placeholder="@username" style={SI}/></Field>
        <Field label="ЦВЕТ"><div style={{display:"flex",gap:5,marginTop:3}}>{AVATAR_COLORS.map(c=><div key={c} onClick={()=>setNewM(p=>({...p,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:newM.color===c?"3px solid #fff":"3px solid transparent"}}/>)}</div></Field>
      </div>
      <Field label="ЗАМЕТКИ"><textarea value={newM.note} onChange={e=>setNewM(p=>({...p,note:e.target.value}))} placeholder="Специализация, контакты..." style={{...SI,minHeight:55,resize:"vertical"}}/></Field>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={()=>setAdding(false)} style={{flex:1,background:"transparent",border:"1px solid #2d2d44",borderRadius:8,padding:"8px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>Отмена</button>
        <button onClick={addMember} style={{flex:2,background:"linear-gradient(135deg,#06b6d4,#0891b2)",border:"none",borderRadius:8,padding:"8px",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Добавить</button>
      </div>
    </div>}
    {teamMembers.length===0&&!adding&&<div style={{textAlign:"center",padding:"50px 0",color:"#9ca3af"}}><div style={{fontSize:36,marginBottom:8}}>👥</div><div style={{fontSize:12,color:"#9ca3af"}}>Нет сотрудников</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
      {teamMembers.map(m=><div key={m.id} style={{background:"#111118",border:`1px solid ${m.color}25`,borderTop:`3px solid ${m.color}`,borderRadius:12,padding:"14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
<div style={{width:40,height:40,borderRadius:"50%",background:`linear-gradient(135deg,${m.color},${m.color}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff",flexShrink:0}}>{((m.name||"?")[0]).toUpperCase()}</div>
          <div style={{flex:1}}>
            <input value={m.name} onChange={e=>isDirector&&setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,name:e.target.value}:x))} onBlur={e=>isDirector&&api.updateUser(m.id,{name:e.target.value}).catch(()=>{})} readOnly={!isDirector} style={{...SI,padding:"3px 7px",fontSize:13,fontWeight:700,marginBottom:3,opacity:isDirector?1:0.7}}/>
            <select value={m.role} onChange={e=>isDirector&&setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,role:e.target.value}:x))} disabled={!isDirector} style={{...SI,padding:"2px 7px",fontSize:10,opacity:isDirector?1:0.7}}>{ROLES_LIST.map(r=><option key={r} value={r}>{r}</option>)}</select>
          </div>
          {isDirector&&<button onClick={async()=>{ await api.deleteUser(m.id).catch(()=>{}); setTeamMembers(p=>p.filter(x=>x.id!==m.id)); }} style={{background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:14,alignSelf:"flex-start"}}>×</button>}
        </div>
        <input value={m.telegram} onChange={e=>setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,telegram:e.target.value}:x))} placeholder="@telegram" style={{...SI,marginBottom:6,fontSize:11}}/>
        <textarea value={m.note} onChange={e=>setTeamMembers(p=>p.map(x=>x.id===m.id?{...x,note:e.target.value}:x))} placeholder="Заметки..." style={{...SI,minHeight:50,resize:"vertical",fontSize:11,lineHeight:1.4,marginBottom:8}}/>
        {(()=>{const la=Number(m.last_active);return la>1000000000?<div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",textAlign:"right",marginTop:4}}>🕐 {new Date(la).toLocaleString("ru",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>:<div style={{fontSize:9,color:"#2d2d44",fontFamily:"monospace",textAlign:"right",marginTop:4}}>🕐 не заходил</div>;})()}

      </div>)}
    </div>
  </div>;
}

function DirectorPage({currentUser, onBack}) {
  const [tab, setTab] = React.useState("files");
  const [files, setFiles] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [deleting, setDeleting] = React.useState(null);

  React.useEffect(() => {
    if (tab === "files") loadFiles();
    if (tab === "logs") loadLogs();
  }, [tab]);

  async function loadFiles() {
    setLoading(true);
    try { const r = await fetch("/api/director/files"); setFiles(await r.json()); }
    catch(e) { console.error(e); }
    setLoading(false);
  }

  async function loadLogs() {
    setLoading(true);
    try { const r = await fetch("/api/director/logs"); setLogs(await r.json()); }
    catch(e) { console.error(e); }
    setLoading(false);
  }

  async function deleteFile(key, name) {
    if (!window.confirm("Удалить файл " + name + " из хранилища?")) return;
    setDeleting(key);
    try {
      await fetch("/api/director/files", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({key}) });
      setFiles(p => p.filter(f => f.key !== key));
    } catch(e) { alert("Ошибка: " + e.message); }
    setDeleting(null);
  }

  function fmt(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes/1024).toFixed(1) + " KB";
    return (bytes/1048576).toFixed(1) + " MB";
  }

  function fmtDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleString("ru", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  const filtFiles = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const totalSize = files.reduce((s,f) => s + (f.size||0), 0);

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#f0eee8",fontFamily:"Inter,sans-serif"}}>
      {/* Header */}
      <div style={{background:"#111118",borderBottom:"1px solid #1e1e2e",padding:"12px 24px",display:"flex",alignItems:"center",gap:16}}>
        <button onClick={onBack} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 12px",color:"#9ca3af",cursor:"pointer",fontSize:12}}>← Назад</button>
        <div style={{fontSize:16,fontWeight:800,color:"#8b5cf6"}}>🔐 Панель директора</div>
        <div style={{marginLeft:"auto",fontSize:11,color:"#4b5563"}}>👤 {currentUser?.name}</div>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid #1e1e2e",background:"#111118"}}>
        {[["files","📁 Файлы"],["logs","📋 Логи активности"]].map(([id,label]) =>
          <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 24px",background:"transparent",border:"none",borderBottom:tab===id?"2px solid #8b5cf6":"2px solid transparent",color:tab===id?"#8b5cf6":"#6b7280",cursor:"pointer",fontSize:12,fontWeight:tab===id?700:400,fontFamily:"inherit"}}>{label}</button>
        )}
      </div>
      <div style={{padding:24,maxWidth:1200,margin:"0 auto"}}>
        {tab === "files" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по имени..." style={{background:"#16161f",border:"1px solid #2d2d44",borderRadius:8,padding:"7px 12px",color:"#f0eee8",fontSize:12,outline:"none",width:280}}/>
              <div style={{fontSize:11,color:"#4b5563",marginLeft:"auto"}}>
                {files.length} файлов · {fmt(totalSize)}
              </div>
              <button onClick={loadFiles} style={{background:"#1e1e35",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 14px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>🔄 Обновить</button>
            </div>
            {loading ? <div style={{textAlign:"center",color:"#4b5563",padding:40}}>Загрузка...</div> :
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {filtFiles.map(f => {
                const isAudio = /\.(webm|ogg|mp3|m4a|wav)$/i.test(f.name);
                const isVideo = /\.(mp4|mov|avi|mkv)$/i.test(f.name);
                const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);
                const icon = isAudio?"🎙️":isVideo?"🎬":isImg?"🖼️":"📎";
                return (
                  <div key={f.key} style={{display:"flex",alignItems:"center",gap:10,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                    <span style={{flex:1,fontSize:11,color:"#d1d5db",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                    <span style={{fontSize:10,color:"#4b5563",flexShrink:0,width:80,textAlign:"right"}}>{fmt(f.size)}</span>
                    <span style={{fontSize:10,color:"#4b5563",flexShrink:0,width:130,textAlign:"right"}}>{fmtDate(f.lastModified)}</span>
                    <a href={`/api/download?key=${encodeURIComponent(f.key)}&name=${encodeURIComponent(f.name)}`} target="_blank" rel="noreferrer"
                      style={{flexShrink:0,background:"#06b6d420",border:"1px solid #06b6d440",borderRadius:5,padding:"3px 10px",color:"#06b6d4",fontSize:10,fontWeight:700,textDecoration:"none"}}>↓</a>
                    <button onClick={()=>deleteFile(f.key,f.name)} disabled={deleting===f.key}
                      style={{flexShrink:0,background:"#ef444415",border:"1px solid #ef444430",borderRadius:5,padding:"3px 8px",color:deleting===f.key?"#4b5563":"#ef4444",cursor:deleting===f.key?"not-allowed":"pointer",fontSize:10}}>
                      {deleting===f.key?"...":"🗑"}
                    </button>
                  </div>
                );
              })}
              {filtFiles.length===0 && <div style={{textAlign:"center",color:"#4b5563",padding:40}}>Файлы не найдены</div>}
            </div>}
          </div>
        )}
        {tab === "logs" && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по имени сотрудника..." style={{background:"#16161f",border:"1px solid #2d2d44",borderRadius:8,padding:"7px 12px",color:"#f0eee8",fontSize:12,outline:"none",width:280}}/>
              <button onClick={loadLogs} style={{marginLeft:"auto",background:"#1e1e35",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 14px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>🔄 Обновить</button>
            </div>
            {loading ? <div style={{textAlign:"center",color:"#4b5563",padding:40}}>Загрузка...</div> :
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {logs.filter(l => !search || (l.user_name||"").toLowerCase().includes(search.toLowerCase())).map(l => {
                const isLog = l.file_name === "__log__";
                return (
                  <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"7px 12px",opacity:isLog?0.6:1}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"#1e1e35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#8b5cf6",flexShrink:0}}>
                      {(l.user_name||"?")[0]?.toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:700,color:"#d1d5db"}}>{l.user_name||"Неизвестный"}</span>
                        <span style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>{l.user_role||""}</span>
                        <span style={{fontSize:9,color:"#374151",marginLeft:"auto",flexShrink:0}}>{fmtDate(l.created_at)}</span>
                      </div>
                      {l.text && <div style={{fontSize:11,color:isLog?"#6b7280":"#9ca3af",marginTop:2,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{isLog?"⚙️ "+l.text:l.text}</div>}
                      {l.file_name && l.file_name!=="__log__" && <div style={{fontSize:10,color:"#06b6d4",marginTop:2}}>📎 {l.file_name}</div>}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}

function IntellectBoard({ projects, currentUser }) {
  const [stickers, setStickers] = useState([]);
  const [arrows,   setArrows]   = useState([]);
  const [scale,    setScale]    = useState(1);
  const [pan,      setPan]      = useState({ x: 60, y: 60 });
  const [loading,  setLoading]  = useState(true);
  const [mode,     setMode]     = useState("select"); // "select" | "arrow"
  const [arrowStart, setArrowStart] = useState(null);
  const [dragging,   setDragging]   = useState(null);
  const [resizing,   setResizing]   = useState(null);
  const [panning,    setPanning]    = useState(null);
  const [editing,    setEditing]    = useState(null);
  const [hoverArrow, setHoverArrow] = useState(null);
  const boardRef    = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const MIN_W = 140, MIN_H = 100;

  // ── Load ──
  useEffect(() => {
    Promise.all([
      fetch("/api/stickers").then(r=>r.json()).catch(()=>[]),
      fetch("/api/sticker-arrows").then(r=>r.json()).catch(()=>[]),
    ]).then(([s,a])=>{ setStickers(Array.isArray(s)?s:[]); setArrows(Array.isArray(a)?a:[]); setLoading(false); });
  }, []);

  const projOf  = id => projects.find(p=>p.id===id);
  const colorOf = id => projOf(id)?.color || "#a78bfa";

  // ── Add sticker ──
  function addSticker() {
    const id  = genId();
    const proj = projects.find(p=>!p.archived) || projects[0];
    const rot  = (Math.random()-0.5)*3;
    // Place in visible area center
    const cx = (boardRef.current?.clientWidth/2  || 400) / scale - pan.x/scale;
    const cy = (boardRef.current?.clientHeight/2 || 300) / scale - pan.y/scale;
    const s = { id, project_id:proj?.id||"all", text:"", color:proj?.color||"#a78bfa",
      x:Math.max(10,cx-100+Math.random()*80-40),
      y:Math.max(10,cy-80 +Math.random()*60-30),
      w:200, h:160, rot, author_id:currentUser?.id||"" };
    setStickers(p=>[...p,s]);
    setEditing(id);
    fetch("/api/stickers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}).catch(()=>{});
  }

  // ── Patch / delete ──
  function patchS(id, patch) {
    setStickers(p=>p.map(s=>s.id===id?{...s,...patch}:s));
    fetch(`/api/stickers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}).catch(()=>{});
  }
  function delS(id) {
    setStickers(p=>p.filter(s=>s.id!==id));
    setArrows(p=>p.filter(a=>a.from!==id&&a.to!==id));
    fetch(`/api/stickers/${id}`,{method:"DELETE"}).catch(()=>{});
    fetch(`/api/sticker-arrows/by-sticker/${id}`,{method:"DELETE"}).catch(()=>{});
  }
  function delArrow(id) {
    setArrows(p=>p.filter(a=>a.id!==id));
    fetch(`/api/sticker-arrows/${id}`,{method:"DELETE"}).catch(()=>{});
  }

  // ── Zoom ──
  function zoom(delta, cx, cy) {
    setScale(prev => {
      const next = Math.min(3, Math.max(0.15, prev * delta));
      if (cx!=null && cy!=null) {
        setPan(p => ({
          x: cx - (cx - p.x) * (next/prev),
          y: cy - (cy - p.y) * (next/prev),
        }));
      }
      return next;
    });
  }

  // ── Wheel zoom (cursor-centered) ──
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      zoom(e.deltaY < 0 ? 1.1 : 0.9, cx, cy);
    };
    el.addEventListener("wheel", onWheel, {passive:false});
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale]);

  // ── Mouse events ──
  function onBoardDown(e) {
    if (e.button === 1) { e.preventDefault(); setPanning({sx:e.clientX,sy:e.clientY,ox:pan.x,oy:pan.y}); return; }
    if (e.button === 0 && mode==="select") {
      const tgt = e.target;
      if (tgt===boardRef.current || tgt.dataset.bg) {
        setPanning({sx:e.clientX,sy:e.clientY,ox:pan.x,oy:pan.y});
      }
    }
  }
  function onStickerDown(e, s) {
    if (mode==="arrow" || e.target.closest(".stk-ctrl") || e.target.closest(".stk-rsz") || e.target.tagName==="TEXTAREA" || e.target.tagName==="SELECT") return;
    e.preventDefault(); e.stopPropagation();
    setDragging({id:s.id,sx:e.clientX,sy:e.clientY,ox:s.x,oy:s.y});
  }
  function onResizeDown(e, s) {
    e.preventDefault(); e.stopPropagation();
    setResizing({id:s.id,sx:e.clientX,sy:e.clientY,ow:s.w,oh:s.h});
  }
  function onStickerClick(e, s) {
    if (mode!=="arrow") return;
    e.stopPropagation();
    if (!arrowStart) { setArrowStart(s.id); return; }
    if (arrowStart===s.id) { setArrowStart(null); return; }
    const exists = arrows.find(a=>(a.from===arrowStart&&a.to===s.id)||(a.from===s.id&&a.to===arrowStart));
    if (exists) { delArrow(exists.id); }
    else {
      const id=genId(); const arr={id,from:arrowStart,to:s.id};
      setArrows(p=>[...p,arr]);
      fetch("/api/sticker-arrows",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(arr)}).catch(()=>{});
    }
    setArrowStart(null);
  }

  useEffect(() => {
    function onMove(e) {
      if (dragging) {
        const dx=(e.clientX-dragging.sx)/scale, dy=(e.clientY-dragging.sy)/scale;
        setStickers(p=>p.map(s=>s.id===dragging.id?{...s,x:Math.max(0,dragging.ox+dx),y:Math.max(0,dragging.oy+dy)}:s));
      }
      if (resizing) {
        const dx=(e.clientX-resizing.sx)/scale, dy=(e.clientY-resizing.sy)/scale;
        setStickers(p=>p.map(s=>s.id===resizing.id?{...s,w:Math.max(MIN_W,resizing.ow+dx),h:Math.max(MIN_H,resizing.oh+dy)}:s));
      }
      if (panning) setPan({x:panning.ox+(e.clientX-panning.sx),y:panning.oy+(e.clientY-panning.sy)});
    }
    function onUp() {
      if (dragging) { const s=stickers.find(x=>x.id===dragging.id); if(s) patchS(s.id,{x:s.x,y:s.y}); setDragging(null); }
      if (resizing) { const s=stickers.find(x=>x.id===resizing.id); if(s) patchS(s.id,{w:s.w,h:s.h}); setResizing(null); }
      if (panning) setPanning(null);
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return ()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[dragging,resizing,panning,stickers,scale]);

  // ── Arrow geometry ──
  function arrowPath(a) {
    const f=stickers.find(s=>s.id===a.from), t=stickers.find(s=>s.id===a.to);
    if(!f||!t) return null;
    const fx=f.x+f.w/2, fy=f.y+f.h/2, tx=t.x+t.w/2, ty=t.y+t.h/2;
    const dx=tx-fx, dy=ty-fy;
    const d=`M${fx},${fy} C${fx+dx*0.4-dy*0.15},${fy+dy*0.4+dx*0.15} ${tx-dx*0.4+dy*0.15},${ty-dy*0.4-dx*0.15} ${tx},${ty}`;
    return {d, id:a.id, color:colorOf(f.project_id)};
  }

  const arrowPaths = arrows.map(arrowPath).filter(Boolean);

  // ── Minimap ──
  const MM_W=160, MM_H=100;
  const mmScaleX=MM_W/BOARD_W, mmScaleY=MM_H/BOARD_H;
  const vpW=(boardRef.current?.clientWidth||800)/scale;
  const vpH=(boardRef.current?.clientHeight||600)/scale;
  const vpX=-pan.x/scale, vpY=-pan.y/scale;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 48px)",background:"#07070f",overflow:"hidden",position:"relative"}}>

      {/* ── Toolbar ── */}
      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:"1px solid #1a1a2e",background:"#0d0d16"}}>
        <span style={{fontSize:14,fontWeight:800,color:"#f0eee8",marginRight:2}}>🧠 Интелект-доска</span>

        <div style={{display:"flex",background:"#111118",borderRadius:8,border:"1px solid #1e1e2e",overflow:"hidden"}}>
          {[["select","☝️ Выбор"],["arrow","↗️ Стрелка"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setArrowStart(null);}}
              style={{padding:"5px 13px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,
                background:mode===m?"#1e1e2e":"transparent",color:mode===m?"#f0eee8":"#4b5563"}}>{l}</button>
          ))}
        </div>

        {arrowStart&&<span style={{fontSize:11,color:"#f59e0b",fontFamily:"monospace"}}>⬤ Выберите второй стикер...</span>}
        <div style={{flex:1}}/>

        <button onClick={addSticker}
          style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",border:"none",borderRadius:9,
            padding:"7px 18px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          + Стикер
        </button>
      </div>

      {/* ── Canvas ── */}
      <div ref={boardRef} onMouseDown={onBoardDown}
        onMouseMove={e=>{const r=boardRef.current?.getBoundingClientRect();if(r)mousePosRef.current={x:e.clientX-r.left,y:e.clientY-r.top};}}
        style={{flex:1,position:"relative",overflow:"hidden",
          cursor:panning?"grabbing":mode==="arrow"?"crosshair":"default",
          backgroundImage:`radial-gradient(circle, #1e1e2e 1px, transparent 1px)`,
          backgroundSize:`${28*scale}px ${28*scale}px`,
          backgroundPosition:`${pan.x%( 28*scale)}px ${pan.y%(28*scale)}px`,
        }}>
        <div data-bg="1" style={{position:"absolute",inset:0}}/>

        {/* Scaled world */}
        <div style={{position:"absolute",left:pan.x,top:pan.y,
          transform:`scale(${scale})`,transformOrigin:"0 0",width:BOARD_W,height:BOARD_H}}>

          {/* SVG arrows */}
          <svg style={{position:"absolute",inset:0,width:BOARD_W,height:BOARD_H,overflow:"visible",pointerEvents:"none"}}>
            <defs>
              {arrowPaths.map(a=>(
                <marker key={a.id} id={`ah${a.id}`} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L9,3.5 z" fill={a.color} opacity="0.9"/>
                </marker>
              ))}
            </defs>
            {arrowPaths.map(a=>(
              <g key={a.id} style={{pointerEvents:"all"}}
                onMouseEnter={()=>setHoverArrow(a.id)} onMouseLeave={()=>setHoverArrow(null)}
                onClick={()=>delArrow(a.id)} style={{cursor:"pointer",pointerEvents:"all"}}>
                <path d={a.d} fill="none" stroke={a.color} strokeWidth={hoverArrow===a.id?4:2.5} opacity={hoverArrow===a.id?1:0.7} markerEnd={`url(#ah${a.id})`}/>
                <path d={a.d} fill="none" stroke="transparent" strokeWidth="14"/>
              </g>
            ))}
          </svg>

          {/* Stickers */}
          {stickers.map(s=>{
            const isDrag=dragging?.id===s.id;
            const isResize=resizing?.id===s.id;
            const isArrowSrc=arrowStart===s.id;
            const p=projOf(s.project_id);
            const c=p?.color||"#a78bfa";
            return (
              <div key={s.id}
                onMouseDown={e=>onStickerDown(e,s)}
                onClick={e=>onStickerClick(e,s)}
                style={{
                  position:"absolute",left:s.x,top:s.y,width:s.w,height:s.h,
                  background:`linear-gradient(160deg, ${c}f0 0%, ${c}cc 100%)`,
                  borderRadius:"3px 14px 12px 3px",
                  boxShadow:isDrag
                    ?`0 28px 50px rgba(0,0,0,0.65),3px 3px 0 rgba(0,0,0,0.2)`
                    :`3px 5px 14px rgba(0,0,0,0.5),2px 2px 0 rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.2)`,
                  cursor:mode==="arrow"?"crosshair":isDrag?"grabbing":"grab",
                  display:"flex",flexDirection:"column",
                  transform:isDrag?`rotate(${(s.rot||0)+2}deg) scale(1.05) translateY(-4px)`:`rotate(${s.rot||0}deg)`,
                  transition:isDrag||isResize?"none":"box-shadow 0.15s,transform 0.2s",
                  zIndex:isDrag||editing===s.id?300:isArrowSrc?200:1,
                  userSelect:"none",
                }}>

                {/* Fold corner */}
                <div style={{position:"absolute",top:0,right:0,width:20,height:20,
                  background:`linear-gradient(225deg,rgba(0,0,0,0.22) 50%,transparent 50%)`,
                  borderRadius:"0 14px 0 0",pointerEvents:"none"}}/>

                {/* Arrow highlight ring */}
                {mode==="arrow"&&<div style={{position:"absolute",inset:0,borderRadius:"3px 14px 12px 3px",
                  border:`2.5px solid ${isArrowSrc?"#fff":"rgba(255,255,255,0.35)"}`,
                  boxShadow:isArrowSrc?"0 0 16px #fffa":"none",pointerEvents:"none"}}/>}

                {/* Header */}
                <div className="stk-ctrl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"6px 8px 3px",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:"rgba(0,0,0,0.3)",flexShrink:0}}/>
                    <select value={s.project_id}
                      onChange={e=>{const np=projects.find(x=>x.id===e.target.value);patchS(s.id,{project_id:e.target.value,color:np?.color||"#a78bfa"});}}
                      onClick={e=>e.stopPropagation()}
                      onMouseDown={e=>e.stopPropagation()}
                      style={{background:"transparent",border:"none",outline:"none",fontSize:9,color:"rgba(0,0,0,0.5)",
                        cursor:"pointer",fontFamily:"inherit",fontWeight:700,maxWidth:80,
                        WebkitAppearance:"none",appearance:"none"}}>
                      {projects.filter(x=>!x.archived).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </div>
                  {/* Delete button — always visible */}
                  <button
                    onMouseDown={e=>e.stopPropagation()}
                    onClick={e=>{e.stopPropagation();delS(s.id);}}
                    style={{background:"rgba(0,0,0,0.18)",border:"none",borderRadius:6,
                      width:20,height:20,cursor:"pointer",fontSize:14,
                      color:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",
                      justifyContent:"center",lineHeight:1,flexShrink:0,fontWeight:700}}>×</button>
                </div>

                {/* Text */}
                <div style={{flex:1,padding:"2px 10px 8px",overflow:"hidden"}}>
                  {editing===s.id?(
                    <textarea autoFocus value={s.text}
                      onMouseDown={e=>e.stopPropagation()}
                      onChange={e=>setStickers(p=>p.map(x=>x.id===s.id?{...x,text:e.target.value}:x))}
                      onBlur={()=>{patchS(s.id,{text:stickers.find(x=>x.id===s.id)?.text||""});setEditing(null);}}
                      style={{width:"100%",height:"100%",background:"transparent",border:"none",outline:"none",
                        resize:"none",fontSize:13,color:"rgba(0,0,0,0.78)",fontFamily:"inherit",lineHeight:1.55}}/>
                  ):(
                    <div onClick={e=>{if(mode!=="arrow"){e.stopPropagation();setEditing(s.id);}}}
                      style={{width:"100%",height:"100%",fontSize:13,lineHeight:1.55,
                        whiteSpace:"pre-wrap",wordBreak:"break-word",cursor:"text",
                        color:s.text?"rgba(0,0,0,0.78)":"rgba(0,0,0,0.32)",fontStyle:s.text?"normal":"italic"}}>
                      {s.text||"Нажмите чтобы написать..."}
                    </div>
                  )}
                </div>

                {/* Resize handle */}
                <div className="stk-rsz" onMouseDown={e=>onResizeDown(e,s)}
                  style={{position:"absolute",bottom:0,right:0,width:20,height:20,
                    cursor:"nwse-resize",display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:4}}>
                  <svg width="10" height="10"><path d="M1 10L10 1M5 10L10 5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>
              </div>
            );
          })}
        </div>

        {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#4b5563",fontSize:13}}>⏳ Загрузка...</div>}
        {!loading&&stickers.length===0&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#2d2d44",pointerEvents:"none"}}>
            <div style={{fontSize:52,marginBottom:12}}>🧠</div>
            <div style={{fontSize:14,fontWeight:700}}>Доска пуста</div>
            <div style={{fontSize:11,marginTop:6}}>Нажмите «+ Стикер» чтобы начать</div>
          </div>
        )}

        {/* ── Zoom panel (right side) ── */}
        <div style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",
          display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:14,padding:"10px 8px",
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
          <button onClick={()=>zoom(1.2, mousePosRef.current.x, mousePosRef.current.y)}
            style={{width:34,height:34,borderRadius:9,background:"#1e1e2e",border:"1px solid #2d2d44",
              color:"#f0eee8",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>+</button>
          <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace",writingMode:"horizontal-tb",minWidth:30,textAlign:"center"}}>
            {Math.round(scale*100)}%
          </span>
          <button onClick={()=>zoom(0.83, mousePosRef.current.x, mousePosRef.current.y)}
            style={{width:34,height:34,borderRadius:9,background:"#1e1e2e",border:"1px solid #2d2d44",
              color:"#f0eee8",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
          <div style={{width:24,height:1,background:"#1e1e2e",margin:"2px 0"}}/>
          <button onClick={()=>{setScale(1);setPan({x:60,y:60});}}
            title="Сбросить"
            style={{width:34,height:34,borderRadius:9,background:"#111118",border:"1px solid #1e1e2e",
              color:"#4b5563",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>⌖</button>
        </div>

        {/* ── Minimap ── */}
        <div style={{position:"absolute",right:16,bottom:16,
          width:MM_W,height:MM_H,background:"#0a0a14",
          border:"1px solid #1e1e2e",borderRadius:10,overflow:"hidden",
          boxShadow:"0 4px 20px rgba(0,0,0,0.6)"}}>
          <svg width={MM_W} height={MM_H} style={{display:"block"}}>
            {/* Stickers in minimap */}
            {stickers.map(s=>{
              const c=colorOf(s.project_id);
              return <rect key={s.id}
                x={s.x*mmScaleX} y={s.y*mmScaleY}
                width={Math.max(4,s.w*mmScaleX)} height={Math.max(3,s.h*mmScaleY)}
                rx="1" fill={c} opacity="0.75"/>;
            })}
            {/* Arrows in minimap */}
            {arrowPaths.map(a=>{
              const scaled = a.d.replace(/([\d.]+),([\d.]+)/g, (_,x,y)=>`${parseFloat(x)*mmScaleX},${parseFloat(y)*mmScaleY}`);
              return <path key={a.id} d={scaled} fill="none" stroke={a.color} strokeWidth="1" opacity="0.5"/>;
            })}
            {/* Viewport rect */}
            <rect
              x={Math.max(0,vpX*mmScaleX)} y={Math.max(0,vpY*mmScaleY)}
              width={Math.min(MM_W,vpW*mmScaleX)} height={Math.min(MM_H,vpH*mmScaleY)}
              fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.4" rx="1"/>
          </svg>
          <div style={{position:"absolute",bottom:3,left:5,fontSize:8,color:"#2d2d44",fontFamily:"monospace",pointerEvents:"none"}}>minimap</div>
        </div>
      </div>
    </div>
  );
}

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


export { UnreadMentions, SummaryView, ContentPlanView, AnalyticsView, StarredReelsView, BaseProjectsView, BaseView, TrainingView, ProjectCard, TeamView, DirectorPage, IntellectBoard, CalendarView, ProjectsView };
