import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS, TABS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";

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

export default AnalyticsView;
