import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";

function MTag({children, color}){
  const colorMap = {
    grey:{bg:"#6b728018",c:"#6b7280",b:"#6b728030"},
    yellow:{bg:"#f59e0b18",c:"#f59e0b",b:"#f59e0b30"},
    purple:{bg:"#8b5cf618",c:"#a78bfa",b:"#8b5cf630"},
    green:{bg:"#10b98118",c:"#10b981",b:"#10b98130"},
    blue:{bg:"#3b82f618",c:"#60a5fa",b:"#3b82f630"},
    red:{bg:"#ef444418",c:"#ef4444",b:"#ef444430"},
    pink:{bg:"#ec489918",c:"#ec4899",b:"#ec489930"},
  };
  const col = colorMap[color] || colorMap.grey;
  return <span style={{...M.tag, background:col.bg, color:col.c, borderColor:col.b}}>{children}</span>;
}

function MStatusBadge({status, statuses}){
  const st = statuses.find(s=>s.id===status)||{l:status,c:"#6b7280"};
  return <MTag color={STATUS_COLOR_KEY(st.c)}>{st.l}</MTag>;
}

function MAvatar({member, size=28}){
  if(!member) return null;
  return <div style={{width:size,height:size,borderRadius:"50%",background:member.color||"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.42,fontWeight:800,color:"#fff",border:"2px solid #0d0d14",flexShrink:0}}>{(member.name||"?")[0].toUpperCase()}</div>;
}

function MTaskCard({item, type, projects, team, onOpen}){
  const ALL_STATUSES = [...PRE_STATUSES,...PROD_STATUSES,...POST_STATUSES,...PUB_STATUSES];
  const st = ALL_STATUSES.find(s=>s.id===item.status)||{l:item.status,c:"#6b7280"};
  const proj = projects.find(p=>p.id===item.project)||{label:"",color:"#6b7280"};
  const typeMap = {pre:"✍️",prod:"🎬",post_reels:"🎞",post_video:"📹",post_carousel:"🖼",pub:"🚀"};
  const dateStr = item.deadline||item.shoot_date||item.planned_date||item.post_deadline||"";
  const memberIds = ["producer","editor","scriptwriter","operator","designer","customer","executor"].map(f=>item[f]).filter(Boolean);
  const members = [...new Set(memberIds)].slice(0,4).map(id=>team.find(m=>m.id===id)).filter(Boolean);

  return (
    <div style={{...M.card, borderLeft:`3px solid ${proj.color||"#6b7280"}`}} onClick={()=>onOpen(type,item)}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
        <span style={{fontSize:16,lineHeight:1,flexShrink:0,marginTop:1}}>{typeMap[type]||"📋"}</span>
        <div style={{fontSize:14,fontWeight:700,color:"#f0eee8",lineHeight:1.35,flex:1}}>{item.title||"Без названия"}</div>
      </div>
      <div style={M.tags}>
        {proj.label&&<span style={{...M.tag,color:proj.color,borderColor:proj.color+"40",background:proj.color+"12"}}>{proj.label}</span>}
        <MStatusBadge status={item.status} statuses={ALL_STATUSES}/>
      </div>
      <div style={M.cfoot}>
        <div style={{...M.avs}}>
          {members.map((m,i)=><MAvatar key={m.id} member={m} size={24}/>)}
        </div>
        {dateStr&&<span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>📅 {dateStr}</span>}
      </div>
    </div>
  );
}

function MPubCard({item, projects, onOpen, onStar}){
  const st = PUB_STATUSES.find(s=>s.id===item.status)||{l:item.status,c:"#6b7280"};
  const proj = projects.find(p=>p.id===item.project)||{label:"",color:"#6b7280"};
  const pubTypeLabel = item.pub_type==="carousel"?"🖼 Карусель":item.pub_type==="video"?"🎬 Видео":"📝 Пост";
  const cnt = item.pub_type==="carousel"?1:Math.max(1,parseInt(item.reels_count)||1);

  return (
    <div style={{...M.card, borderLeft:`3px solid ${st.c}`}} onClick={()=>onOpen("pub",item)}>
      <div style={{display:"flex",alignItems:"flex-start",gap:6}}>
        <div style={{flex:1}}>
          <div style={M.cardTitle}>{item.title||"Без названия"}</div>
          <div style={M.tags}>
            {proj.label&&<span style={{...M.tag,color:proj.color,borderColor:proj.color+"40",background:proj.color+"12"}}>{proj.label}</span>}
            <MTag color={STATUS_COLOR_KEY(st.c)}>{st.l}</MTag>
            <span style={M.tag}>{pubTypeLabel}</span>
            {cnt>1&&<span style={{...M.tag,color:"#a78bfa",borderColor:"#8b5cf630",background:"#8b5cf612"}}>×{cnt}</span>}
          </div>
        </div>
        <span onClick={e=>{e.stopPropagation();onStar&&onStar(item);}} style={{color:item.starred?"#f59e0b":"#2d2d44",fontSize:22,cursor:"pointer",lineHeight:1,padding:4}}>★</span>
      </div>
      {item.planned_date&&<div style={{fontSize:10,color:"#4b5563",fontFamily:"monospace",marginTop:4}}>📅 {item.planned_date}</div>}
    </div>
  );
}

function MTasksScreen({preItems,prodItems,postReels,postVideo,postCarousels,pubItems,projects,team,onOpen,onAdd,currentUser}){
  const [filter,setFilter] = useState("all");
  const [search,setSearch] = useState("");
  const [myOnly,setMyOnly] = useState(false);

  const sections = [
    {id:"post_reels", label:"РИЛСЫ", color:"#ec4899", items:postReels},
    {id:"post_video", label:"ВИДЕО", color:"#3b82f6", items:postVideo},
    {id:"post_carousel", label:"КАРУСЕЛИ", color:"#a78bfa", items:postCarousels},
    {id:"pre", label:"СЦЕНАРИИ", color:"#8b5cf6", items:preItems},
    {id:"prod", label:"СЪЁМКИ", color:"#3b82f6", items:prodItems},
    {id:"pub", label:"ПУБЛИКАЦИИ", color:"#10b981", items:pubItems},
  ];

  const filterGroups = [
    {id:"all",l:"Все"},
    {id:"post",l:"Постпродакшн"},
    {id:"pre",l:"Препродакшн"},
    {id:"prod",l:"Съёмки"},
    {id:"pub",l:"Публикации"},
  ];

  const isInGroup = (id, g) => {
    if(g==="all") return true;
    if(g==="post") return ["post_reels","post_video","post_carousel"].includes(id);
    return id===g;
  };

  const myFields = ["producer","editor","scriptwriter","operator","designer","customer","executor"];
  const filterItem = item => {
    if(myOnly && currentUser && !myFields.some(f=>item[f]===currentUser.id)) return false;
    if(search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return !item.archived;
  };

  const visibleSections = sections
    .filter(s=>isInGroup(s.id,filter))
    .map(s=>({...s, items:s.items.filter(filterItem)}))
    .filter(s=>s.items.length>0);

  const total = sections.reduce((acc,s)=>acc+s.items.filter(x=>!x.archived).length,0);

  return <>
    {/* Шапка */}
    <div style={M.sh}>
      <div style={{...M.shRow,marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={M.title}>Задачи</div>
          <div style={M.sub}>{total} активных</div>
        </div>
        <button style={M.actionBtn} onClick={onAdd}>+ Создать</button>
      </div>
      {/* Поиск */}
      <div style={{position:"relative",marginBottom:10}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#4b5563"}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию..."
          style={{width:"100%",background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"9px 12px 9px 36px",color:"#f0eee8",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      </div>
      {/* Фильтры */}
      <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>
        {filterGroups.map(c=>(
          <button key={c.id} style={{...M.chip,...(filter===c.id?M.chipGreen:{})}} onClick={()=>setFilter(c.id)}>{c.l}</button>
        ))}
        <button style={{...M.chip,...(myOnly?{background:"#f59e0b18",borderColor:"#f59e0b55",color:"#f59e0b"}:{})}} onClick={()=>setMyOnly(p=>!p)}>Мои</button>
      </div>
    </div>

    {/* Список */}
    <div style={{...M.scroll,...M.pad}}>
      {visibleSections.map(s=>(
        <div key={s.id} style={{marginBottom:20}}>
          <div style={M.secH}>
            <span style={{...M.secT,color:s.color}}>{s.label}</span>
            <span style={{fontSize:11,color:"#374151",fontFamily:"monospace",background:"#111118",border:"1px solid #1e1e2e",borderRadius:8,padding:"2px 8px"}}>{s.items.length}</span>
          </div>
          {s.items.map(item=>(
            <MTaskCard key={item.id} item={item} type={s.id} projects={projects} team={team} onOpen={onOpen}/>
          ))}
        </div>
      ))}
      {visibleSections.length===0&&(
        <div style={{textAlign:"center",color:"#374151",fontSize:13,padding:"60px 0"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔍</div>
          <div>Задач не найдено</div>
        </div>
      )}
    </div>
  </>;
}

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

function MobileApp({currentUser,onLogout,stores}){
  const {preItems,prodItems,postReels,postVideo,postCarousels,pubItems,projects,teamMembers:team,modal,openEdit,openNew,close,save,deleteTask,setPubItems,sendToPub} = stores;
  const [tab,setTab]=useState("tasks");
  const [notifOpen,setNotifOpen]=useState(false);
  const [notifs,setNotifs]=useState([]);
  const saveFnRef=useRef(null);

  useEffect(()=>{
    let cancelled=false;
    function poll(){
      if(cancelled) return;
      fetch("/api/notifications",{headers:{"x-user-id":currentUser.id}})
        .then(r=>r.ok?r.json():[]).then(data=>{if(!cancelled)setNotifs(data);}).catch(()=>{});
    }
    poll(); const iv=setInterval(poll,15000); return()=>{cancelled=true;clearInterval(iv);};
  },[currentUser.id]);

  const unread=notifs.filter(n=>!n.read).length;
  const activeTotal=[...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...pubItems].filter(x=>!x.archived).length;

  function markAllRead(){
    fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({})})
      .then(()=>setNotifs([])).catch(()=>{});
  }

  const tabs=[
    {id:"tasks",  icon:"📋", label:"Задачи",   badge:activeTotal>0?activeTotal:null},
    {id:"pub",    icon:"🚀", label:"Публикации",badge:null},
    {id:"analytics",icon:"📊",label:"Рилсы",  badge:null},
    {id:"summary",icon:"⚡", label:"Сводка",   badge:null},
    {id:"base",   icon:"🗂", label:"База",      badge:null},
  ];

  // toggle star для публикаций
  function toggleStar(item){
    const starred=!item.starred;
    stores.setPubItems?.(prev=>prev.map(x=>x.id===item.id?{...x,starred}:x));
    fetch(`/api/tasks/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({data:{starred}})}).catch(()=>{});
  }

  return (
    <div style={{height:"100vh",height:"100dvh",background:"#0d0d14",color:"#f0eee8",display:"flex",flexDirection:"column",fontFamily:"'Inter',sans-serif",overflow:"hidden",position:"relative"}}>

      {/* TOP BAR */}
      <div style={{background:"#0d0d14",borderBottom:"1px solid #111118",padding:"env(safe-area-inset-top, 10px) 16px 10px",paddingTop:`max(env(safe-area-inset-top, 10px), 10px)`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#7c3aed,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🍇</div>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,letterSpacing:-0.3}}>Виноград</div>
        </div>
        {/* Уведомления */}
        <button onClick={()=>setNotifOpen(p=>!p)} style={{position:"relative",background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18}}>
          🔔
          {unread>0&&<span style={{position:"absolute",top:4,right:4,width:8,height:8,borderRadius:"50%",background:"#ef4444",border:"2px solid #0d0d14"}}/>}
        </button>
        {/* Аватар / выход */}
        <div onClick={onLogout} style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg,${currentUser.color||"#6b7280"},${currentUser.color||"#6b7280"}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#fff",cursor:"pointer",flexShrink:0}}>
          {(currentUser.name||"?")[0].toUpperCase()}
        </div>
      </div>

      {/* SCREENS */}
      <div style={{flex:1,overflow:"hidden",position:"relative"}}>
        {tab==="tasks"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MTasksScreen preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} projects={projects} team={team} onOpen={openEdit} onAdd={()=>openNew("post_reels")} currentUser={currentUser}/>
        </div>}
        {tab==="pub"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MPubScreen pubItems={pubItems} projects={projects} team={team} onOpen={openEdit} onAdd={()=>openNew("pub")} onStar={toggleStar}/>
        </div>}
        {tab==="contentplan"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <ContentPlanView projects={projects} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} kpisData={kpis} teamMembers={teamMembers}/>
        </div>}
        {tab==="analytics"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MAnalyticsScreen pubItems={pubItems} projects={projects}/>
        </div>}
        {tab==="summary"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MSummaryScreen preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} projects={projects} team={team} currentUser={currentUser} onOpen={openEdit}/>
        </div>}
        {tab==="calendar"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <CalendarView projects={projects} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems||[]} onOpenTask={(type,item)=>openEdit(type,item)} onNewTask={(dateStr)=>{
            setModal({type:"post_reels",item:{...defItem("post_reels"),post_deadline:dateStr}});
          }}/>
        </div>}
        {tab==="base"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column"}}>
          <MBaseScreen projects={projects} setProjects={stores.setProjects} teamMembers={team} setTeamMembers={stores.setTeam} currentUser={currentUser}/>
        </div>}
      </div>

      {/* BOTTOM NAV */}
      <div style={{background:"#0a0a0f",borderTop:"1px solid #111118",display:"flex",alignItems:"stretch",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 4px 10px",cursor:"pointer",background:"transparent",border:"none",position:"relative",transition:"background 0.15s",borderTop:tab===t.id?"2px solid #8b5cf6":"2px solid transparent"}}>
            <span style={{fontSize:20,lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:9,fontFamily:"monospace",fontWeight:700,color:tab===t.id?"#a78bfa":"#374151",letterSpacing:"0.03em"}}>{t.label}</span>
            {t.badge&&<span style={{position:"absolute",top:6,right:"calc(50% - 12px)",background:"#ef4444",color:"#fff",fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:8,fontFamily:"monospace",minWidth:16,textAlign:"center"}}>{t.badge>99?"99+":t.badge}</span>}
          </button>
        ))}
      </div>

      {/* УВЕДОМЛЕНИЯ */}
      {notifOpen&&<>
        <div onClick={()=>setNotifOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",zIndex:40}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#111118",borderRadius:"24px 24px 0 0",borderTop:"1px solid #1e1e2e",zIndex:41,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"12px 20px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:36,height:4,background:"#2d2d44",borderRadius:2,margin:"0 auto 0",position:"absolute",left:"50%",transform:"translateX(-50%)",top:8}}/>
            <div style={{fontSize:16,fontWeight:800,flex:1}}>🔔 Уведомления</div>
            {notifs.length>0&&<button onClick={markAllRead} style={{fontSize:10,color:"#4b5563",background:"transparent",border:"1px solid #1e1e2e",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}>Прочитать все</button>}
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"8px 16px 20px"}}>
            {notifs.length===0&&<div style={{color:"#4b5563",fontSize:13,textAlign:"center",padding:"30px 0"}}>Нет уведомлений</div>}
            {notifs.map(n=>(
              <div key={n.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid #1a1a2e",alignItems:"flex-start"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:n.read?"#1e1e2e":"#8b5cf6",marginTop:5,flexShrink:0,boxShadow:n.read?"none":"0 0 6px #8b5cf6"}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#f0eee8",lineHeight:1.35}}>{n.title}</div>
                  {n.body&&<div style={{fontSize:11,color:"#4b5563",marginTop:3,lineHeight:1.4}}>{n.body}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* МОДАЛКИ */}
      {modal?.type==="pre"           &&<Modal title="Препродакшн — Сценарий"  color="#8b5cf6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pre",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><PreForm           item={modal.item} onSave={d=>save("pre",d)}            onDelete={id=>deleteTask("pre",id)}           onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
      {modal?.type==="prod"          &&<Modal title="Продакшн — Съёмка"       color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("prod",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><ProdForm          item={modal.item} onSave={d=>save("prod",d)}           onDelete={id=>deleteTask("prod",id)}          onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
      {modal?.type==="post_reels"    &&<Modal title="Постпродакшн — Рилс"     color="#ec4899" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_reels",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><PostReelsForm     item={modal.item} onSave={d=>save("post_reels",d)}     onDelete={id=>deleteTask("post_reels",id)}    onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_reels",d)}/></Modal>}
      {modal?.type==="post_video"    &&<Modal title="Постпродакшн — Видео"    color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_video",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><PostVideoForm     item={modal.item} onSave={d=>save("post_video",d)}     onDelete={id=>deleteTask("post_video",id)}    onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_video",d)}/></Modal>}
      {modal?.type==="post_carousel" &&<Modal title="Постпродакшн — Карусель" color="#a78bfa" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_carousel",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><PostCarouselForm  item={modal.item} onSave={d=>save("post_carousel",d)}  onDelete={id=>deleteTask("post_carousel",id)} onClose={close} projects={projects} team={team} currentUser={currentUser} onSendToPub={d=>sendToPub("post_carousel",d)}/></Modal>}
      {modal?.type==="admin"         &&<Modal title="Административная задача"  color="#f97316" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("admin",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><AdminForm          item={modal.item} onSave={d=>save("admin",d)}           onDelete={id=>deleteTask("admin",id)}         onClose={close} projects={projects} team={team} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
      {modal?.type==="pub"           &&<Modal title="Публикация"               color="#10b981" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pub",modal.item.id):undefined} taskId={modal.item?.id} team={team} currentUser={currentUser}><PubForm           item={modal.item} onSave={d=>save("pub",d)}            onDelete={id=>deleteTask("pub",id)}           onClose={close} saveFnRef={saveFnRef} projects={projects} team={team} currentUser={currentUser}/></Modal>}
    </div>
  );
}


export { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard, MTasksScreen, MPubScreen, MAnalyticsScreen, MSummaryScreen, MBaseScreen, MobileApp };
export default MobileApp;
