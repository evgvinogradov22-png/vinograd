import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS, TABS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";

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

export default ContentPlanView;
