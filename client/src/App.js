import React, { useState, useRef, useEffect } from "react";
import RU_HOLIDAYS from "./holidays";
import { api, createWS } from "./api";
import LoginScreen from "./LoginScreen";
import { APP_NAME, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, pubCount, SI, LB, MONTHS, WDAYS, AVATAR_COLORS } from "./constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload, r2key, triggerDownload } from "./utils/files";
import { genId, teamOf, projOf, stColor, getTaskStore } from "./utils/helpers";
import { Field, Btn, Badge, TeamSelect, StatusRow, FilterBar, SaveRow, UploadProgress, TzField } from "./components/ui";
import MiniChat from "./components/chat/MiniChat";
import { Kanban, CalView, WeekView } from "./components/kanban";
import Modal from "./components/modal/Modal";
import { FinalFileOrLink, SourceInputs, SlideImageUpload, PreForm, ProdForm, PostReelsForm, PostVideoForm, PostCarouselForm, PubForm, AdminForm, SingleReelStats, ReelStatsBlock } from "./components/forms";
import { UnreadMentions, SummaryView, ContentPlanView, AnalyticsView, StarredReelsView, BaseProjectsView, BaseView, TrainingView, ProjectCard, TeamView, DirectorPage, IntellectBoard, CalendarView, ProjectsView } from "./components/views";
import MobileApp from "./components/mobile";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("[ErrorBoundary]", e, info); this.setState({info}); }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || "Неизвестная ошибка";
      const stack = this.state.info?.componentStack || "";
      return (
        <div style={{padding:24,color:"#f0eee8",fontFamily:"monospace",background:"#0d0d14",minHeight:"100vh",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:20}}>⚠️</div>
          <div style={{fontSize:14,fontWeight:700,color:"#ef4444"}}>Ошибка приложения</div>
          <div style={{fontSize:11,color:"#9ca3af",background:"#111118",padding:12,borderRadius:8,wordBreak:"break-all"}}>{msg}</div>
          <button onClick={()=>{ localStorage.removeItem("vg_user"); window.location.reload(); }} style={{background:"#ef444420",border:"1px solid #ef444440",borderRadius:8,padding:"10px 16px",color:"#ef4444",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>🔄 Выйти и перезайти</button>
          <button onClick={()=>window.location.reload()} style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:8,padding:"10px 16px",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>↩ Перезагрузить</button>
        </div>
      );
    }
    return this.props.children;
  }
}


function MainApp({currentUser, onLogout}){
  const [isMobile,setIsMobile]=useState(()=>window.innerWidth<=768);
  useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<=768);
    window.addEventListener("resize",fn);
    return()=>window.removeEventListener("resize",fn);
  },[]);

  const [tab,setTab]=useState("pre");
  const [viewMode,setViewMode]=useState("kanban");
  const [postSubTab,setPostSubTab]=useState("reels");
  const [pubViewMode,setPubViewMode]=useState("week");
  const [projects,setProjects]=useState([]);
  const [teamMembers,setTeamMembers]=useState([]);
  const [preItems,setPreItems]=useState([]);
  const [prodItems,setProdItems]=useState([]);
  const [postReels,setPostReels]=useState([]);
  const [postVideo,setPostVideo]=useState([]);
  const [postCarousels,setPostCarousels]=useState([]);
  const [pubItems,setPubItems]=useState([]);
  const [adminItems,setAdminItems]=useState([]);
  const [kpis,setKpis]=useState({});
  const [modal,setModal]=useState(null);
  const saveFnRef = useRef(null);
  // Stores object for useTaskStore — avoids repeated chains
  const stores = {preItems,setPreItems,prodItems,setProdItems,postReels,setPostReels,postVideo,setPostVideo,postCarousels,setPostCarousels,pubItems,setPubItems,adminItems,setAdminItems};
  const [loading,setLoading]=useState(true);
  const [notifs,setNotifs]=useState([]);
  const [showNotifs,setShowNotifs]=useState(false);
  const globalWsRef=useRef(null);

  // ── Load data from API ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const [projs, users, tasks] = await Promise.all([
          api.getProjects(),
          api.getUsers(),
          api.getTasks(),
        ]);
        setProjects(projs.map(p => ({...p, links: p.links || [], archived: p.archived || false})));
        // Load KPIs for sidebar analytics badge
        fetch("/api/analytics/kpi").then(r=>r.ok?r.json():[]).then(rows=>{
          const map={}; rows.forEach(r=>{map[`${r.project_id}_${r.year}_${r.month}`]=String(r.kpi);}); setKpis(map);
        }).catch(()=>{});
        setTeamMembers(users.map(u => ({...u, note: u.note || ""})));
        // Split tasks by type and merge data field
        const expand = t => {
          const d = t.data || {};
          return {
            id: t.id, project: t.project_id, status: t.status, title: t.title, type: t.type,
            completed_at: t.completed_at || "", starred: t.starred || false, chat: [],
            // safe array defaults to prevent crashes
            refs:         d.refs         || [],
            equipment:    d.equipment    || [],
            actors:       d.actors       || [],
            checklist:    d.checklist    || [],
            source_links: d.source_links || [],
            slides:       d.slides       || [],
            ...d,
            archived: t.archived || false, // column value always wins over data JSON
          };
        };
        setPreItems(tasks.filter(t=>t.type==="pre").map(expand));
        setProdItems(tasks.filter(t=>t.type==="prod").map(expand));
        setPostReels(tasks.filter(t=>t.type==="post_reels").map(expand));
        setPostVideo(tasks.filter(t=>t.type==="post_video").map(expand));
        setPostCarousels(tasks.filter(t=>t.type==="post_carousel").map(expand));
        setPubItems(tasks.filter(t=>t.type==="pub").map(expand));
        setAdminItems(tasks.filter(t=>t.type==="admin").map(expand));
      } catch(e) { console.error("Load error:", e); }
      setLoading(false);
    }
    loadAll();
  }, []);

  // ── Notifications: polling + WS ────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();

    const seenIds = new Set();

    function applyNotifs(rows) {
      const fresh = rows.filter(r => !seenIds.has(r.id));
      if (!fresh.length) return;
      fresh.forEach(r => seenIds.add(r.id));
      setNotifs(p => {
        const merged = [...fresh.map(r=>({id:r.id,kind:r.kind,taskId:r.task_id,taskType:r.task_type,title:r.title,text:r.body,ts:Number(r.created_at),read:r.read})), ...p].slice(0,50);
        return merged;
      });
      // Browser push for each new notif
      fresh.forEach(r => {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const body = r.kind === "chat_message" ? (r.body||"Новое сообщение") : "Новая задача назначена на вас";
          const n = new Notification("🍇 " + (r.title||"Виноград"), { body });
          n.onclick = () => { window.focus(); n.close(); };
        }
      });
    }

    const authHeaders = () => {
      const h = { "x-user-id": currentUser.id };
      const token = currentUser.token || localStorage.getItem("vg_token");
      if (token) h["Authorization"] = "Bearer " + token;
      return h;
    };

    // Initial load
    fetch("/api/notifications", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : []).then(applyNotifs).catch(()=>{});

    // WS — primary delivery mechanism (no polling)
    const proto = location.protocol === "https:" ? "wss" : "ws";
    let ws;
    function connectWS() {
      ws = new WebSocket(`${proto}://${location.host}`);
      globalWsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "join_user", userId: currentUser.id }));
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== "notification") return;
          // Fetch fresh notifications on WS event
          fetch("/api/notifications", { headers: authHeaders() })
            .then(r => r.ok ? r.json() : []).then(applyNotifs).catch(()=>{});
        } catch {}
      };
      ws.onclose = () => { setTimeout(connectWS, 4000); };
    }
    connectWS();

    return () => {
      if (ws) ws.close();
    };
  }, [currentUser?.id]);

  // Per-tab filters — must be before any conditional return!
  const [preFilt,setPreFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [prodFilt,setProdFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [postFilt,setPostFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [pubFilt,setPubFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [showArchivedAdmin,setShowArchivedAdmin]=useState(false);
  const [adminFilt,setAdminFilt]=useState({pf:"all",member:"all",sortBy:"default"});
  const [showArchivedPre,setShowArchivedPre]=useState(false);
  const [showArchivedProd,setShowArchivedProd]=useState(false);
  const [showArchivedPost,setShowArchivedPost]=useState(false);
  const [showArchivedPub,setShowArchivedPub]=useState(false);

  if (loading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,background:"#0a0a0f"}}>
      <div style={{fontSize:48}}>🍇</div>
      <div style={{fontSize:12,color:"#9ca3af",fontFamily:"monospace"}}>Загрузка...</div>
    </div>
  );

  const activeProjs=projects.filter(p=>!p.archived);

  function applyFilter(items,filt,memberFields=["producer","editor","scriptwriter","operator","designer"],showArchived=false){
    items=showArchived ? items.filter(x=>x.archived) : items.filter(x=>!x.archived);
    let r=items;
    if(filt.pf!=="all") r=r.filter(x=>x.project===filt.pf);
    if(filt.member!=="all") r=r.filter(x=>memberFields.some(f=>x[f]===filt.member));
    if(showArchived){ return [...r].sort((a,b)=>(b.completed_at||"").localeCompare(a.completed_at||"")); }
    if(filt.sortBy==="deadline") r=[...r].sort((a,b)=>(a.deadline||a.shoot_date||a.planned_date||"")>(b.deadline||b.shoot_date||b.planned_date||"")?1:-1);
    if(filt.sortBy==="project") r=[...r].sort((a,b)=>a.project>b.project?1:-1);
    if(filt.sortBy==="status") r=[...r].sort((a,b)=>a.status>b.status?1:-1);
    return r;
  }

  const filtPre=applyFilter(preItems,preFilt,undefined,showArchivedPre);
  const filtProd=applyFilter(prodItems,prodFilt,undefined,showArchivedProd);
  const filtPostReels=applyFilter(postReels,postFilt,undefined,showArchivedPost);
  const filtPostVideo=applyFilter(postVideo,postFilt,undefined,showArchivedPost);
  const filtPostCarousels=applyFilter(postCarousels,postFilt,undefined,showArchivedPost);
  const filtPub=applyFilter(pubItems,pubFilt,undefined,showArchivedPub);
  const filtAdmin=applyFilter(adminItems,adminFilt,undefined,showArchivedAdmin);

  const ct=TABS.find(t=>t.id===tab);

  function defItem(type,extra={}){
    const proj=""; // No default project — user must choose
    const base={pre:{id:genId(),title:"",type:"Сценарий",project:proj,status:"idea",brief:"",script:"",refs:[],deadline:"",scriptwriter:"",producer:"",chat:[]},
      prod:{id:genId(),title:"",type:"Рилс",project:proj,status:"planned",location:"",equipment:[],actors:[],shoot_date:"",checklist:[],producer:"",operator:"",chat:[]},
      post_reels:{id:genId(),title:"",project:proj,status:"not_started",source_name:"",source_url:"",transcript:"",tz:"",birolls:"",final_link:"",post_deadline:"",producer:"",editor:"",chat:[]},
      post_video:{id:genId(),title:"",project:proj,status:"not_started",source_links:[],tz:"",final_link:"",post_deadline:"",producer:"",editor:"",chat:[]},
      post_carousel:{id:genId(),title:"",project:proj,status:"not_started",slides:[{id:genId(),text:"",img:"",img_name:""}],cover_text:"",tz:"",final_link:"",post_deadline:"",producer:"",designer:"",chat:[]},
      pub:{id:genId(),title:"",project:proj,status:"draft",planned_date:"",caption:"",hashtags:"",producer:"",file_name:"",reels_count:1,pub_type:"video",chat:[]},
    };
    return {...base[type],...extra};
  }

  function openNew(type,extra={}){ setModal({type,item:defItem(type,extra)}); }
  function openEdit(type,item){
    if(item._toggleStar){ toggleStar(type,item); return; }
    const safe={
      refs:         item.refs         ?? [],
      equipment:    item.equipment    ?? [],
      actors:       item.actors       ?? [],
      checklist:    item.checklist    ?? [],
      source_links: item.source_links ?? [],
      slides:       item.slides?.length ? item.slides : [{id:genId(),text:"",img:"",img_name:""}],
      tz:           item.tz           ?? "",
      transcript:   item.transcript   ?? "",
      birolls:      item.birolls      ?? "",
      final_link:   item.final_link   ?? "",
      source_name:  item.source_name  ?? "",
      source_url:   cleanR2Url(item.source_url ?? ""),
      cover_text:   item.cover_text   ?? "",
      caption:      item.caption      ?? "",
      hashtags:     item.hashtags     ?? "",
      file_name:    item.file_name    ?? "",
      file_url:     item.file_url     ?? "",
      file_key:     item.file_key     ?? "",
      brief:        item.brief        ?? "",
      script:       item.script       ?? "",
      location:     item.location     ?? "",
      post_deadline:item.post_deadline?? "",
      deadline:     item.deadline     ?? "",
    };
    setModal({type, item:{...item,...safe}});
  }
  function close(){ setModal(null); }

  async function toggleStar(type, item){
    const newVal = !item.starred;
    // optimistic update
    const [,setter] = getTaskStore(type, stores);
    setter(p=>p.map(x=>x.id===item.id?{...x,starred:newVal}:x));
    try {
      const { id, project, status, title, chat, archived, ...rest } = {...item, starred:newVal};
      await api.updateTask(id, { type, title:title||"", project_id:project, status, archived:archived||false, data:{...rest,starred:newVal} });
    } catch(e){ console.error("toggleStar error:",e); }
  }

  async function save(type,d){
    try {
      const { id, project, status, title, chat, archived, ...rest } = d;
      const payload = { type, title: title||"", project_id: project||"none", status, archived: archived||false, data: rest };
      // Check if item exists already
      const [getter, setter] = getTaskStore(type, stores);
      const exists = getter.find(x=>x.id===id);
      if (exists) {
        await api.updateTask(id, payload);
        // Preserve chat from store — don't overwrite with potentially empty d.chat
        setter(p=>p.map(x=>x.id===id?{...d, chat: x.chat||d.chat||[]}:x));
      } else {
        const saved = await api.createTask({...payload, id});
        const expanded = {id:saved.id,project:saved.project_id,status:saved.status,title:saved.title,archived:saved.archived||false,chat:[],...(saved.data||{})};
        setter(p=>[...p, expanded]);
      }
    } catch(e) { console.error("Save error:", e); alert("Ошибка сохранения: "+e.message); }
    close();
  }

  async function deleteTask(type,id){
    const [,setter] = getTaskStore(type, stores);
    try{ await api.deleteTask(id); setter(p=>p.filter(x=>x.id!==id)); close(); }
    catch(e){ alert("Ошибка удаления: "+e.message); }
  }

  function archiveTask(type,id){
    const [getter,setter] = getTaskStore(type, stores);
    const item=getter.find(x=>x.id===id);
    if(!item) return;
    const newVal=!item.archived;
    setter(p=>p.map(x=>x.id===id?{...x,archived:newVal}:x));
    api.updateTask(id,{archived:newVal}).catch(e=>console.error("Archive error:",e));
  }

  async function sendToPub(sourceType, sourceItem) {
    const pubType = sourceType==="post_carousel" ? "carousel" : "video";
    const reelsCount = sourceItem.reels_count || sourceItem.video_count || 1;
    const newId = genId();
    const newPub = {
      id: newId,
      title: sourceItem.title || "",
      project: sourceItem.project || "",
      status: "draft",
      pub_type: pubType,
      reels_count: reelsCount,
      producer: sourceItem.producer || "",
      planned_date: "",
      caption: "",
      hashtags: "",
      file_name: sourceItem.final_file_name || "",
      file_url: sourceItem.final_file_url || "",
      file_key: sourceItem.final_file_key || "",
      chat: [],
    };
    // Optimistic: archive source + add pub item locally
    const [,srcSetter] = getTaskStore(sourceType, stores);
    srcSetter(p=>p.map(x=>x.id===sourceItem.id?{...x,archived:true}:x));
    setPubItems(p=>[...p, newPub]);
    // Transactional server call — both ops in one DB transaction
    try {
      const {id,project,...rest} = newPub;
      await fetch("/api/tasks/send-to-pub", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          sourceId: sourceItem.id,
          pubTask: { id, type:"pub", title:newPub.title, project_id:project, status:"draft", data:rest }
        })
      });
    } catch(e) {
      // Rollback on error
      srcSetter(p=>p.map(x=>x.id===sourceItem.id?{...x,archived:false}:x));
      setPubItems(p=>p.filter(x=>x.id!==newId));
      alert("Ошибка отправки на публикацию: "+e.message);
      return;
    }
    close();
    setTimeout(()=>setModal({type:"pub", item:newPub}), 50);
  }
  function drop(type,id,newStatus){
    const DONE_STATUSES=["done","approved","published"];
    const completedAt=DONE_STATUSES.includes(newStatus)?new Date().toISOString().slice(0,10):"";
    const [getter, setterDrop] = getTaskStore(type, stores);
    // Save old status for rollback
    const oldItem = getter.find(x=>x.id===id);
    const oldStatus = oldItem?.status;
    // Optimistic update
    setterDrop(p=>p.map(x=>x.id===id?{...x,status:newStatus,completed_at:completedAt}:x));
    const patch={status:newStatus};
    if(completedAt) patch.completed_at=completedAt;
    api.updateTask(id, patch).catch(e=>{
      console.error("Drop error:",e);
      // Rollback on failure
      if(oldStatus) setterDrop(p=>p.map(x=>x.id===id?{...x,status:oldStatus}:x));
    });
    if(type==="pub" && newStatus==="published") setPubViewMode("published");
  }

  function moveToDay(type,id,newDate){
    const field=type==="prod"?"shoot_date":"planned_date";
    const upd=setter=>setter(p=>p.map(x=>x.id===id?{...x,[field]:newDate}:x));
    if(type==="prod") upd(setProdItems);
    else if(type==="pub") upd(setPubItems);
    // get current item data and patch
    const [getter2] = getTaskStore(type, stores);
    const item=getter2.find(x=>x.id===id);
    const [,setter2] = getTaskStore(type, stores);
    setter2(p=>p.map(x=>x.id===id?{...x,[field]:newDate}:x));
    if(item){ const {id:_id,project,status,title,chat,...rest}=item; api.updateTask(id,{data:{...rest,[field]:newDate}}).catch(e=>console.error(e)); }
  }

  function mkCard(item,type){
    const proj=projOf(item.project,projects);
    const chatCount=(item.chat||[]).length;
    const custId=item.customer||item.producer||"";
    const execId=item.executor||item.editor||item.scriptwriter||item.operator||item.designer||"";
    const cust=teamOf(custId,teamMembers);
    const exec=teamOf(execId,teamMembers);
    const dateStr=item.deadline||item.shoot_date?.slice(0,10)||item.planned_date?.slice(0,10)||item.post_deadline||"";
    const daysLeft=dateStr?Math.ceil((new Date(dateStr).getTime()-Date.now())/86400000):null;
    const urgent=daysLeft!==null&&daysLeft<=2;
    return <div onClick={()=>openEdit(type,item)} style={{background:"#111118",borderTop:`1px solid ${item.starred?"#f59e0b50":urgent?"#ef444450":"#1e1e2e"}`,borderRight:`1px solid ${item.starred?"#f59e0b50":urgent?"#ef444450":"#1e1e2e"}`,borderBottom:`1px solid ${item.starred?"#f59e0b50":urgent?"#ef444450":"#1e1e2e"}`,borderLeft:`3px solid ${item.starred?"#f59e0b":urgent?"#ef4444":"#374151"}`,borderRadius:8,padding:"10px 11px",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.background="#16161f"} onMouseLeave={e=>e.currentTarget.style.background="#111118"}>
      <div style={{display:"flex",alignItems:"flex-start",gap:5,marginBottom:5}}>
        <div style={{fontWeight:700,fontSize:12,flex:1}}>{item.title||"Без названия"}</div>
        {type==="pub"&&<button onClick={e=>{e.stopPropagation();toggleStar(type,item);}} title="Залётный рилс"
          style={{background:"transparent",border:"none",cursor:"pointer",fontSize:15,padding:0,flexShrink:0,color:item.starred?"#f59e0b":"#2d2d44",lineHeight:1}}
          onMouseEnter={e=>e.currentTarget.style.color=item.starred?"#d97706":"#6b7280"}
          onMouseLeave={e=>e.currentTarget.style.color=item.starred?"#f59e0b":"#2d2d44"}>★</button>}
      </div>
      <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
        <Badge color="#374151">{proj.label}</Badge>
        {type==="pub"&&<Badge color={item.pub_type==="carousel"?"#a78bfa":"#3b82f6"}>{item.pub_type==="carousel"?"🖼 Карусель":`🎬 Рилс${(item.reels_count||1)>1?" ×"+(item.reels_count||1):""}`}</Badge>}
        {type==="post_reels"&&<Badge color="#ec4899">🎞 Рилс</Badge>}
        {type==="post_video"&&<Badge color="#3b82f6">🎬 Видео</Badge>}
        {type==="post_carousel"&&<Badge color="#a78bfa">🖼 Карусель</Badge>}
        {type==="post_carousel"&&item.slides&&item.slides.length>0&&<Badge color="#4b5563">📋 {item.slides.length} сл.</Badge>}
      </div>
      {/* Заказчик → Исполнитель */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:9,color:"#9ca3af"}}>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:cust?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{cust?cust.name:"заказчик"}</span>
        <span style={{color:"#9ca3af",flexShrink:0}}>→</span>
        <span style={{background:"#1a1a2e",borderRadius:4,padding:"2px 7px",color:exec?"#a0aec0":"#2d2d44",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{exec?exec.name:"исполнитель"}</span>
      </div>
      {/* Дедлайн */}
      {item.completed_at&&item.status==="done"&&<div style={{fontSize:9,fontFamily:"monospace",color:"#10b981"}}>✅ Выполнено {item.completed_at}</div>}
      {!item.completed_at&&dateStr&&<div style={{fontSize:9,fontFamily:"monospace",color:urgent?"#ef4444":"#4b5563"}}>📅 {dateStr}{daysLeft!==null&&` (${daysLeft>0?daysLeft+"д":"сегодня"})`}</div>}
      <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center"}}>
        {chatCount>0&&<span style={{fontSize:9,color:"#9ca3af"}}>💬 {chatCount}</span>}
        {(type==="post_reels"||type==="post_video"||type==="post_carousel")&&item.status==="done"&&<button onClick={e=>{
          e.stopPropagation();
          // Mark post task as done
          drop(type,item.id,"done");
          // Create new pub task carrying over final file/link
          const isCarousel = type==="post_carousel";
          const pubItem=defItem("pub",{
            title:item.title,
            project:item.project,
            pub_type:isCarousel?"carousel":"video",
            file_name:item.final_file_name||(isCarousel?"":item.source_name)||"",
            file_url:item.final_file_url||(isCarousel?"":item.source_url)||"",
            slides:isCarousel?(item.slides||[]):[],
          });
          setModal({type:"pub",item:pubItem});
        }} style={{background:"transparent",border:"1px dashed #10b98140",borderRadius:5,padding:"2px 7px",color:"#10b981",cursor:"pointer",fontSize:9}}>🚀 → Публ.</button>}
        {item.archived&&<Badge color="#4b5563">📦 архив</Badge>}
        {(item.archived||["done","approved","published","cancelled"].includes(item.status))&&<button onClick={e=>{e.stopPropagation();archiveTask(type,item.id);}} title={item.archived?"Из архива":"В архив"} style={{marginLeft:"auto",background:"transparent",border:"none",color:item.archived?"#10b981":"#6b7280",cursor:"pointer",fontSize:10,padding:"0 2px"}}>{item.archived?"↩":"📦"}</button>}
      </div>
    </div>;
  }

  const _now = new Date();
  const _curMonth = _now.getMonth(), _curYear = _now.getFullYear();
  const _myId = currentUser?.id;
  const _mf = ["executor","editor","scriptwriter","operator","designer"];
  const _pubThisMonth = pubItems.filter(x=>{ const d=x.planned_date||""; if(!d) return false; const dt=new Date(d); return dt.getMonth()===_curMonth&&dt.getFullYear()===_curYear&&x.status==="published"; }).length;
  const _totalKpi = projects.filter(p=>!p.archived).reduce((s,p)=>s+(parseInt(kpis[`${p.id}_${_curYear}_${_curMonth}`]||"0")||0),0);
  const _kpiPct = _totalKpi>0 ? Math.round((_pubThisMonth/_totalKpi)*100) : null;
  const cnt={
    pre:   preItems.filter(t=>!t.archived&&t.status!=="approved").length,
    prod:  prodItems.filter(t=>!t.archived&&t.status!=="done").length,
    post:  [...postReels,...postVideo,...postCarousels].filter(t=>!t.archived&&t.status!=="done").length,
    pub:   pubItems.filter(t=>!t.archived&&t.status==="scheduled").length,
    admin: adminItems.filter(t=>!t.archived&&t.status!=="done"&&t.status!=="cancelled").length,
    summary: _myId ? [...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...adminItems].filter(t=>!t.archived&&_mf.some(f=>t[f]===_myId)).length : 0,
    analytics: _kpiPct,
    base: 0,
  };

  // ── Mobile stores object ─────────────────────────────────────────────────
  const mobileStores = {
    preItems,prodItems,postReels,postVideo,postCarousels,pubItems,
    setProjects,setTeam:setTeamMembers,setPubItems,
    projects,teamMembers,modal,
    openEdit,openNew,close,save,deleteTask,sendToPub,
  };

  if(isMobile) return <ErrorBoundary key="mobile"><MobileApp currentUser={currentUser} onLogout={onLogout} stores={mobileStores}/></ErrorBoundary>;

  const TASK_TABS = TABS.filter(t=>!["summary","analytics","base"].includes(t.id));
  const META_TABS = TABS.filter(t=>["summary","analytics","base"].includes(t.id));

  return <div style={{fontFamily:"'Syne','Inter',sans-serif",height:"100vh",background:"#0a0a0f",color:"#f0eee8",display:"flex",overflow:"hidden"}}>
    {/* LEFT SIDEBAR */}
    <div style={{width:220,flexShrink:0,background:"#0d0d16",borderRight:"1px solid #1a1a2e",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Logo */}
      <div style={{padding:"16px 16px 12px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#7c3aed,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🍇</div>
        <div>
          <div style={{fontSize:13,fontWeight:800,letterSpacing:"-0.3px"}}>{APP_NAME}</div>
          <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>production system</div>
        </div>
      </div>
      {/* Nav */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
        <div style={{fontSize:9,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase",padding:"8px 8px 4px",fontFamily:"monospace"}}>Задачи</div>
        {TASK_TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setViewMode("kanban");}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"pointer",marginBottom:2,background:tab===t.id?t.color+"15":"transparent",border:"none",color:tab===t.id?t.color:"#9ca3af",fontFamily:"inherit",fontWeight:tab===t.id?700:500,fontSize:12,textAlign:"left",position:"relative"}}>
            {tab===t.id&&<div style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:2,borderRadius:2,background:t.color}}/>}
            <span style={{flex:1}}>{t.label}</span>
            {cnt[t.id]!=null&&cnt[t.id]!==0&&<span style={{fontSize:9,background:tab===t.id?t.color+"25":"#1a1a2e",borderRadius:20,padding:"0 6px",color:tab===t.id?t.color:"#4b5563",fontFamily:"monospace",fontWeight:700}}>{cnt[t.id]}{t.id==="analytics"?"%":""}</span>}
          </button>
        ))}
        <div style={{fontSize:9,fontWeight:700,color:"#4b5563",letterSpacing:".1em",textTransform:"uppercase",padding:"12px 8px 4px",fontFamily:"monospace"}}>Обзор</div>
        {META_TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setViewMode("kanban");}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:"pointer",marginBottom:2,background:tab===t.id?t.color+"15":"transparent",border:"none",color:tab===t.id?t.color:"#9ca3af",fontFamily:"inherit",fontWeight:tab===t.id?700:500,fontSize:12,textAlign:"left",position:"relative"}}>
            {tab===t.id&&<div style={{position:"absolute",left:0,top:"20%",bottom:"20%",width:2,borderRadius:2,background:t.color}}/>}
            <span style={{flex:1}}>{t.label}</span>
          </button>
        ))}
      </div>
      {/* User footer */}
      <div style={{borderTop:"1px solid #1a1a2e",padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:"#1e1e2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#9ca3af",flexShrink:0}}>{(currentUser?.name||currentUser?.telegram||"?")[0].toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.name||"@"+currentUser?.telegram}</div>
            <div style={{fontSize:9,color:"#4b5563"}}>{currentUser?.role||"Участник"}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{width:"100%",marginTop:6,background:"transparent",border:"1px solid #1e1e2e",borderRadius:7,padding:"5px",color:"#4b5563",cursor:"pointer",fontSize:10,fontFamily:"inherit",fontWeight:600}}>Выйти</button>
      </div>
    </div>

    {/* MAIN COLUMN */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
    {/* TOP BAR — notifications + current tab title */}
    <div style={{borderBottom:"1px solid #1a1a2e",background:"#0d0d16",flexShrink:0,padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:2,height:52}}>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15,fontWeight:800,color:TABS.find(t=>t.id===tab)?.color||"#f0eee8"}}>{TABS.find(t=>t.id===tab)?.label||""}</span>
          {!["summary","analytics","base"].includes(tab)&&cnt[tab]>0&&<span style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>· {cnt[tab]}</span>}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,position:"relative"}}>
          {/* 🔔 Bell */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowNotifs(p=>!p)} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:16,position:"relative"}}>
              🔔
              {notifs.filter(n=>!n.read).length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",borderRadius:"50%",fontSize:9,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{notifs.filter(n=>!n.read).length}</span>}
            </button>
            {showNotifs&&<div style={{position:"absolute",top:36,right:0,width:320,background:"#111118",border:"1px solid #2d2d44",borderRadius:12,boxShadow:"0 8px 32px #00000080",zIndex:1000,maxHeight:420,overflowY:"auto"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #1e1e2e"}}>
                <span style={{fontSize:11,fontWeight:700,color:"#f0eee8"}}>🔔 Уведомления</span>
                {notifs.length>0&&<button onClick={()=>{setNotifs([]);fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({})}).catch(()=>{});}} style={{background:"transparent",border:"none",color:"#4b5563",cursor:"pointer",fontSize:10}}>Очистить все</button>}
              </div>
              {notifs.length===0&&<div style={{padding:"24px 14px",textAlign:"center",color:"#4b5563",fontSize:11}}>Нет уведомлений</div>}
              {notifs.map(n=>{
                const taskType=n.taskType||"pre";
                const typeLabel=taskType==="pre"?"Препродакшн":taskType==="prod"?"Продакшн":taskType==="pub"?"Публикация":"Постпродакшн";
                return <div key={n.id} onClick={()=>{
                  setNotifs(p=>p.filter(x=>x.id!==n.id));
                  fetch("/api/notifications/read",{method:"POST",headers:{"Content-Type":"application/json","x-user-id":currentUser.id},body:JSON.stringify({id:n.id})}).catch(()=>{});
                  if(n.taskId){
                    const type=n.taskType||"pre";
                    const tabId=type==="pre"?"pre":type==="prod"?"prod":type.startsWith("post")?"post":"pub";
                    setTab(tabId);
                    const allIt=[...preItems,...prodItems,...postReels,...postVideo,...postCarousels,...pubItems];
                    const found=allIt.find(x=>x.id===n.taskId);
                    if(found) openEdit(type,found);
                  }
                  setShowNotifs(false);
                }} style={{padding:"10px 14px",borderBottom:"1px solid #0d0d16",cursor:"pointer",background:n.read?"transparent":"#0d0d16",display:"flex",gap:10,alignItems:"flex-start"}}
                onMouseEnter={e=>e.currentTarget.style.background="#16161f"}
                onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":"#0d0d16"}>
                  <span style={{fontSize:16,flexShrink:0}}>{n.kind==="chat_message"?"💬":"📋"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#f0eee8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</div>
                    {n.text&&<div style={{fontSize:10,color:"#9ca3af",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.text}</div>}
                    <div style={{fontSize:9,color:"#4b5563",marginTop:3,fontFamily:"monospace"}}>{typeLabel} · {Number(n.ts)>1000000000?new Date(Number(n.ts)).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}):""}</div>
                  </div>
                  {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#8b5cf6",flexShrink:0,marginTop:4}}/>}
                </div>;
              })}
            </div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,background:"#111118",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px"}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:`linear-gradient(135deg,${currentUser.color||"#8b5cf6"},#7c3aed)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff"}}>{(currentUser.name||currentUser.telegram||"?")[0].toUpperCase()}</div>
            <span style={{fontSize:11,fontWeight:600}}>@{currentUser.telegram}</span>
          </div>
          <button onClick={onLogout} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:20,padding:"4px 10px",color:"#9ca3af",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Выйти</button>
        </div>
      </div>
    </div>

    {/* Click outside to close notifs */}
    {showNotifs&&<div onClick={()=>setShowNotifs(false)} style={{position:"fixed",inset:0,zIndex:999}}/>}
    {/* CONTENT */}
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"14px 6px"}}>

      {/* PRE */}
      {tab==="pre"&&<>
        <FilterBar pf={preFilt.pf} setPf={v=>setPreFilt(p=>({...p,pf:v}))} member={preFilt.member} setMember={v=>setPreFilt(p=>({...p,member:v}))} sortBy={preFilt.sortBy} setSortBy={v=>setPreFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Сценарий" onAdd={()=>openNew("pre")} showArchived={showArchivedPre} onArchiveToggle={()=>setShowArchivedPre(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"kanban",l:"Канбан"},{id:"calendar",l:"Календарь"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?"#8b5cf620":"transparent",border:viewMode===v.id?"1px solid #8b5cf640":"1px solid #1e1e2e",color:viewMode===v.id?"#8b5cf6":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {viewMode==="kanban"&&<Kanban statuses={PRE_STATUSES} items={filtPre} renderCard={x=>mkCard(x,"pre")} onDrop={(id,st)=>drop("pre",id,st)} onAddClick={st=>openNew("pre",{status:st})}/>}
        {viewMode==="calendar"&&<CalView items={filtPre} dateField="deadline" onDayClick={d=>openNew("pre",{deadline:d})} color="#8b5cf6" onMoveToDay={(id,day)=>{ setPreItems(p=>p.map(x=>x.id===id?{...x,deadline:day}:x)); const item=preItems.find(x=>x.id===id); if(item){const{id:_,project,status,title,chat,...rest}=item;api.updateTask(id,{data:{...rest,deadline:day}}).catch(()=>{});}}} renderChip={x=>{const p=projOf(x.project,projects);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("pre",x);}} style={{background:p.color+"18",border:`1px solid ${p.color}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:p.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.title}</div>;}}/>}
      </>}

      {/* PROD */}
      {tab==="prod"&&<>
        <FilterBar pf={prodFilt.pf} setPf={v=>setProdFilt(p=>({...p,pf:v}))} member={prodFilt.member} setMember={v=>setProdFilt(p=>({...p,member:v}))} sortBy={prodFilt.sortBy} setSortBy={v=>setProdFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Съёмка" onAdd={()=>openNew("prod")} showArchived={showArchivedProd} onArchiveToggle={()=>setShowArchivedProd(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"kanban",l:"Канбан"},{id:"calendar",l:"Съёмки"}].map(v=><button key={v.id} onClick={()=>setViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:viewMode===v.id?"#3b82f620":"transparent",border:viewMode===v.id?"1px solid #3b82f640":"1px solid #1e1e2e",color:viewMode===v.id?"#3b82f6":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {viewMode==="kanban"&&<Kanban statuses={PROD_STATUSES} items={filtProd} renderCard={x=>mkCard(x,"prod")} onDrop={(id,st)=>drop("prod",id,st)} onAddClick={st=>openNew("prod",{status:st})}/>}
        {viewMode==="calendar"&&<CalView items={filtProd} dateField="shoot_date" onDayClick={d=>openNew("prod",{shoot_date:d+"T10:00"})} color="#3b82f6" onMoveToDay={(id,day)=>moveToDay("prod",id,day+"T10:00")} renderChip={x=>{const p=projOf(x.project,projects);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("prod",x);}} style={{background:p.color+"18",border:`1px solid ${p.color}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:p.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🎬 {x.title}</div>;}}/>}
      </>}

      {/* POST */}
      {tab==="post"&&<>
        <FilterBar pf={postFilt.pf} setPf={v=>setPostFilt(p=>({...p,pf:v}))} member={postFilt.member} setMember={v=>setPostFilt(p=>({...p,member:v}))} sortBy={postFilt.sortBy} setSortBy={v=>setPostFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers}
          addLabel={postSubTab==="reels"?"Рилс":postSubTab==="video"?"Видео":"Карусель"}
          onAdd={()=>openNew(postSubTab==="reels"?"post_reels":postSubTab==="video"?"post_video":"post_carousel")} showArchived={showArchivedPost} onArchiveToggle={()=>setShowArchivedPost(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[["reels","🎞️ Рилсы","#ec4899"],["video","🎬 Видео","#3b82f6"],["carousel","🖼 Карусели","#a78bfa"]].map(([id,l,c])=><button key={id} onClick={()=>setPostSubTab(id)} style={{padding:"4px 11px",borderRadius:6,cursor:"pointer",background:postSubTab===id?c+"20":"transparent",border:postSubTab===id?`1px solid ${c}40`:"1px solid #1e1e2e",color:postSubTab===id?c:"#6b7280",fontSize:11,fontFamily:"inherit",fontWeight:600}}>{l}</button>)}
        </div>
        {postSubTab==="reels"&&<Kanban statuses={POST_STATUSES} items={filtPostReels} renderCard={x=>mkCard(x,"post_reels")} onDrop={(id,st)=>drop("post_reels",id,st)} onAddClick={st=>openNew("post_reels",{status:st})}/>}
        {postSubTab==="video"&&<Kanban statuses={POST_STATUSES} items={filtPostVideo} renderCard={x=>mkCard(x,"post_video")} onDrop={(id,st)=>drop("post_video",id,st)} onAddClick={st=>openNew("post_video",{status:st})}/>}
        {postSubTab==="carousel"&&<Kanban statuses={POST_STATUSES} items={filtPostCarousels} renderCard={x=>mkCard(x,"post_carousel")} onDrop={(id,st)=>drop("post_carousel",id,st)} onAddClick={st=>openNew("post_carousel",{status:st})}/>}
      </>}

      {/* PUB */}
      {tab==="pub"&&<>
        <FilterBar pf={pubFilt.pf} setPf={v=>setPubFilt(p=>({...p,pf:v}))} member={pubFilt.member} setMember={v=>setPubFilt(p=>({...p,member:v}))} sortBy={pubFilt.sortBy} setSortBy={v=>setPubFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Публикацию" onAdd={()=>openNew("pub")} showArchived={showArchivedPub} onArchiveToggle={()=>setShowArchivedPub(p=>!p)}/>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"week",l:"Неделя"},{id:"calendar",l:"Месяц"},{id:"status",l:"По статусам"},{id:"published",l:"Опубликованные"}].map(v=><button key={v.id} onClick={()=>setPubViewMode(v.id)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",background:pubViewMode===v.id?"#10b98120":"transparent",border:pubViewMode===v.id?"1px solid #10b98140":"1px solid #1e1e2e",color:pubViewMode===v.id?"#10b981":"#6b7280",fontSize:11,fontFamily:"inherit"}}>{v.l}</button>)}
        </div>
        {pubViewMode==="week"&&<div style={{overflow:"hidden",width:"100%"}}><WeekView items={filtPub} onItemClick={x=>openEdit("pub",x)} onDayClick={dt=>openNew("pub",{planned_date:dt})} projects={projects} onMoveToDay={(id,dt)=>moveToDay("pub",id,dt)} onToggleStar={x=>toggleStar("pub",x)}/></div>}
        {pubViewMode==="calendar"&&<CalView items={filtPub} dateField="planned_date" onDayClick={d=>openNew("pub",{planned_date:d+"T12:00"})} color="#10b981" onMoveToDay={(id,day)=>moveToDay("pub",id,day+"T12:00")} renderChip={x=>{const sc=stColor(PUB_STATUSES,x.status);return <div key={x.id} onClick={e=>{e.stopPropagation();openEdit("pub",x);}} style={{background:sc+"18",border:`1px solid ${sc}30`,borderRadius:4,padding:"2px 4px",marginBottom:2,fontSize:9,color:sc,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.title}</div>;}}/>}
        {pubViewMode==="status"&&<Kanban statuses={PUB_STATUSES.filter(s=>s.id!=="published")} items={filtPub.filter(x=>x.status!=="published")} onDrop={(id,st)=>drop("pub",id,st)} onAddClick={st=>openNew("pub",{status:st})} renderCard={x=>mkCard(x,"pub")}/>}
        {pubViewMode==="published"&&<PublishedView items={pubItems} projects={projects} onOpen={x=>openEdit("pub",x)} onToggleStar={x=>toggleStar("pub",x)}/>}
      </>}

      {tab==="admin"&&<>
        <FilterBar pf={adminFilt.pf} setPf={v=>setAdminFilt(p=>({...p,pf:v}))} member={adminFilt.member} setMember={v=>setAdminFilt(p=>({...p,member:v}))} sortBy={adminFilt.sortBy} setSortBy={v=>setAdminFilt(p=>({...p,sortBy:v}))} projects={projects} team={teamMembers} addLabel="Задачу" onAdd={()=>openNew("admin")} showArchived={showArchivedAdmin} onArchiveToggle={()=>setShowArchivedAdmin(p=>!p)}/>
        <Kanban statuses={ADMIN_STATUSES} items={filtAdmin} renderCard={x=>mkCard(x,"admin")} onDrop={(id,st)=>drop("admin",id,st)} onAddClick={st=>openNew("admin",{status:st})}/>
      </>}
            {tab==="summary"&&<SummaryView preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems} projects={projects} team={teamMembers} currentUser={currentUser} onOpenTask={(type,item)=>openEdit(type,item)}/>}
      {tab==="contentplan"&&<div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><ContentPlanView projects={projects} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} kpisData={kpis} teamMembers={teamMembers}/></div>}
      {tab==="analytics"&&<AnalyticsView pubItems={pubItems} projects={projects} kpisData={kpis}/>}
      {tab==="board"&&<div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><IntellectBoard projects={projects} currentUser={currentUser}/></div>}
      {tab==="calendar"&&<div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><CalendarView projects={projects} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems||[]} onOpenTask={(type,item)=>openEdit(type,item)} onNewTask={(dateStr)=>{
        // open new task modal pre-filled with date — default to post_reels
        setModal({type:"post_reels",item:{...defItem("post_reels"),post_deadline:dateStr}});
      }}/></div>}
      {tab==="projects"&&<div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><ProjectsView projects={projects} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems} onOpenTask={(type,item)=>openEdit(type,item)}/></div>}
      {tab==="base"&&<ErrorBoundary key="base"><BaseView projects={projects} setProjects={setProjects} teamMembers={teamMembers} setTeamMembers={setTeamMembers} currentUser={currentUser}/></ErrorBoundary>}
    </div>

    {/* MODALS */}
    {modal?.type==="pre"          &&<Modal title="Препродакшн — Сценарий"  color="#8b5cf6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pre",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PreForm          item={modal.item} onSave={d=>save("pre",d)} onDelete={id=>deleteTask("pre",id)}           onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="prod"         &&<Modal title="Продакшн — Съёмка"       color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("prod",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><ProdForm         item={modal.item} onSave={d=>save("prod",d)} onDelete={id=>deleteTask("prod",id)}          onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="post_reels"   &&<Modal title="Постпродакшн — Рилс"    color="#ec4899" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_reels",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PostReelsForm    item={modal.item} onSave={d=>save("post_reels",d)} onDelete={id=>deleteTask("post_reels",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_reels",d)}/></Modal>}
    {modal?.type==="post_video"   &&<Modal title="Постпродакшн — Видео"    color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_video",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PostVideoForm    item={modal.item} onSave={d=>save("post_video",d)} onDelete={id=>deleteTask("post_video",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_video",d)}/></Modal>}
    {modal?.type==="post_carousel"&&<Modal title="Постпродакшн — Карусель" color="#a78bfa" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_carousel",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PostCarouselForm item={modal.item} onSave={d=>save("post_carousel",d)} onDelete={id=>deleteTask("post_carousel",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} onSendToPub={d=>sendToPub("post_carousel",d)}/></Modal>}
    {modal?.type==="admin"        &&<Modal title="Административная задача" color="#f97316" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("admin",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><AdminForm item={modal.item} onSave={d=>save("admin",d)} onDelete={id=>deleteTask("admin",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="pub"          &&<Modal title="Публикация"               color="#10b981" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pub",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PubForm          item={modal.item} onSave={d=>save("pub",d)} onDelete={id=>deleteTask("pub",id)}           onClose={close} saveFnRef={saveFnRef} projects={projects} team={teamMembers} currentUser={currentUser}/></Modal>}
    </div>{/* /MAIN COLUMN */}
  </div>;
}


function AppInner(){
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vg_user") || "null"); } catch { return null; }
  });

  function handleLogout() {
    localStorage.removeItem("vg_user");
    setCurrentUser(null);
  }

  const [showDirector, setShowDirector] = React.useState(() => window.location.hash === "#director");

  React.useEffect(() => {
    const handler = () => setShowDirector(window.location.hash === "#director");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (!currentUser) {
    return <LoginScreen onLogin={u => { localStorage.setItem("vg_user", JSON.stringify(u)); setCurrentUser(u); }}/>;
  }

  if (showDirector && currentUser?.role === "Директор") {
    return <DirectorPage currentUser={currentUser} onBack={()=>{ window.location.hash=""; setShowDirector(false); }}/>;
  }

  return <MainApp currentUser={currentUser} onLogout={handleLogout}/>;
}


export default function App(){
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

