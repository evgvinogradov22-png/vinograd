import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";
import { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard } from "./MobileUI";

function MAnalyticsScreen({pubItems,projects}){
  const [stats,setStats]=useState({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const ids=pubItems.filter(x=>x.status==="published").map(x=>x.id);
    if(!ids.length){setLoading(false);return;}
    fetch("/api/reel-stats/latest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task_ids:ids})})
      .then(r=>r.json()).then(d=>{setStats(d);setLoading(false);}).catch(()=>setLoading(false));
  },[pubItems]);

  function fmt(n){
    if(!n&&n!==0) return "—";
    if(n>=1000000) return (n/1000000).toFixed(1)+"M";
    if(n>=1000) return (n/1000).toFixed(1)+"K";
    return String(n);
  }

  const published = pubItems.filter(x=>x.status==="published");
  const totalViews = published.reduce((s,x)=>s+(parseInt(stats[x.id]?.views)||0),0);
  const totalLikes = published.reduce((s,x)=>s+(parseInt(stats[x.id]?.likes)||0),0);
  const totalComments = published.reduce((s,x)=>s+(parseInt(stats[x.id]?.comments)||0),0);

  const top = published
    .map(x=>({...x,views:parseInt(stats[x.id]?.views)||0,likes:parseInt(stats[x.id]?.likes)||0,comments:parseInt(stats[x.id]?.comments)||0}))
    .filter(x=>x.views>0)
    .sort((a,b)=>b.views-a.views)
    .slice(0,10);

  const StatCard = ({icon,label,value,color})=>(
    <div style={{flex:1,background:"#111118",border:"1px solid #1a1a2e",borderRadius:16,padding:"14px 16px",minWidth:0}}>
      <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginBottom:6}}>{icon} {label}</div>
      <div style={{fontSize:22,fontWeight:800,color,fontFamily:"monospace",letterSpacing:-0.5}}>{fmt(value)}</div>
    </div>
  );

  return <>
    <div style={M.sh}>
      <div style={M.title}>Аналитика</div>
      <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginTop:4}}>{published.reduce((s,x)=>s+pubCount(x),0)} опубликовано · обновление в 07:00</div>
    </div>
    <div style={{...M.scroll,...M.pad}}>
      {loading&&<div style={{textAlign:"center",padding:"40px 0",color:"#4b5563",fontSize:13}}>⏳ Загрузка статистики...</div>}
      {!loading&&<>
        {/* KPI карточки */}
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <StatCard icon="👁" label="ПРОСМОТРЫ" value={totalViews} color="#06b6d4"/>
          <StatCard icon="❤️" label="ЛАЙКИ" value={totalLikes} color="#ec4899"/>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:20}}>
          <StatCard icon="💬" label="КОММ." value={totalComments} color="#8b5cf6"/>
          <StatCard icon="📹" label="ПУБЛИКАЦИЙ" value={pub.reduce((s,x)=>s+pubCount(x),0)} color="#10b981"/>
        </div>

        {/* ERR */}
        {totalViews>0&&totalLikes>0&&(
          <div style={{background:"#111118",border:"1px solid #1a1a2e",borderRadius:16,padding:"14px 16px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>📈 ERR (лайки/просм.)</span>
            <span style={{fontSize:20,fontWeight:800,color:"#f59e0b",fontFamily:"monospace"}}>{(totalLikes/totalViews*100).toFixed(2)}%</span>
          </div>
        )}

        {/* Топ рилсов */}
        {top.length>0&&<>
          <div style={{...M.secH,marginBottom:14}}>
            <span style={M.secT}>🏆 ТОП РИЛСОВ</span>
          </div>
          {top.map((item,i)=>{
            const proj=projects.find(p=>p.id===item.project);
            return (
              <div key={item.id} style={{...M.card,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:10,background:i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#cd7f32":"#1a1a2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:i<3?16:12,fontWeight:800,color:i<3?"#0d0d14":"#4b5563",flexShrink:0}}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f0eee8",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title||"Без названия"}</div>
                    {proj&&<span style={{fontSize:9,color:proj.color,background:proj.color+"18",borderRadius:6,padding:"2px 7px",fontFamily:"monospace"}}>{proj.label}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:12,marginTop:10,paddingTop:10,borderTop:"1px solid #1a1a2e"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#06b6d4",fontFamily:"monospace"}}>{fmt(item.views)}</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>просмотры</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#ec4899",fontFamily:"monospace"}}>{fmt(item.likes)}</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>лайки</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#8b5cf6",fontFamily:"monospace"}}>{fmt(item.comments)}</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>комм.</div>
                  </div>
                  {item.views>0&&item.likes>0&&<div style={{textAlign:"center",marginLeft:"auto"}}>
                    <div style={{fontSize:15,fontWeight:800,color:"#f59e0b",fontFamily:"monospace"}}>{(item.likes/item.views*100).toFixed(1)}%</div>
                    <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>ERR</div>
                  </div>}
                </div>
              </div>
            );
          })}
        </>}

        {top.length===0&&!loading&&(
          <div style={{textAlign:"center",color:"#374151",fontSize:13,padding:"40px 0"}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <div>Нет данных по просмотрам</div>
            <div style={{fontSize:11,color:"#2d2d44",marginTop:8}}>Добавьте ссылку на рилс в карточку публикации</div>
          </div>
        )}
      </>}
    </div>
  </>;
}

export default MAnalyticsScreen;
