import React, { useState, useReducer, useRef, useEffect } from "react";
import { api, createWS } from "./api";
import LoginScreen from "./LoginScreen";
import { APP_NAME, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, pubCount, SI, LB, MONTHS, WDAYS, AVATAR_COLORS } from "./constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload, r2key, triggerDownload } from "./utils/files";
import { genId, teamOf, projOf, stColor, getTaskStore } from "./utils/helpers";
import { Field, Btn, Badge, TeamSelect, StatusRow, FilterBar, SaveRow, UploadProgress, TzField, TaskCard } from "./components/ui";
import MiniChat from "./components/chat/MiniChat";
import Modal from "./components/modal/Modal";
// ── Eager imports — small, used everywhere ────────────────────────────────────
import { UnreadMentions, StarredReelsView } from "./components/views/SummaryView";
import { FinalFileOrLink, SourceInputs, SlideImageUpload, SingleReelStats, ReelStatsBlock } from "./components/forms/shared";

// ── Lazy imports — only loaded when first needed ──────────────────────────────
const { Suspense, lazy } = React;

// Heavy views — load when tab first clicked
const SummaryView      = lazy(() => import("./components/views/SummaryView").then(m => ({default: m.default})));
const ContentPlanView  = lazy(() => import("./components/views/ContentPlanView"));
const AnalyticsView    = lazy(() => import("./components/views/AnalyticsView"));
const CalendarView     = lazy(() => import("./components/views/CalendarView"));
const ProjectsView     = lazy(() => import("./components/views/ProjectsView"));
const IntellectBoard   = lazy(() => import("./components/views/IntellectBoard"));
const BaseView         = lazy(() => import("./components/views/BaseView"));
const DirectorPage     = lazy(() => import("./components/views/DirectorPage"));

// Mobile app — huge, only load on mobile
const MobileApp        = lazy(() => import("./components/mobile/MobileApp"));

// Forms — load when modal first opens
const PreForm          = lazy(() => import("./components/forms/PreForm"));
const ProdForm         = lazy(() => import("./components/forms/ProdForm"));
const PostReelsForm    = lazy(() => import("./components/forms/PostReelsForm"));
const PostVideoForm    = lazy(() => import("./components/forms/PostVideoForm"));
const PostCarouselForm = lazy(() => import("./components/forms/PostCarouselForm"));
const PubForm          = lazy(() => import("./components/forms/PubForm"));
const AdminForm        = lazy(() => import("./components/forms/AdminForm"));
import { PreTab, ProdTab, PostTab, PubTab, AdminTab } from "./components/tabs/TabContent";

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



// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, setViewMode, cnt, currentUser, onLogout }) {
  const TASK_TABS = TABS.filter(t => !["summary","analytics","base"].includes(t.id));
  const META_TABS = TABS.filter(t => ["summary","analytics","base"].includes(t.id));
  return (
    <div style={{width:220,flexShrink:0,background:"#0d0d16",borderRight:"1px solid #1a1a2e",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"16px 16px 12px",borderBottom:"1px solid #1a1a2e",display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#7c3aed,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🍇</div>
        <div>
          <div style={{fontSize:13,fontWeight:800,letterSpacing:"-0.3px"}}>{APP_NAME}</div>
          <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>production system</div>
        </div>
      </div>
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
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ tab, cnt, notifs, setNotifs, showNotifs, setShowNotifs, currentUser, onLogout, preItems, prodItems, postReels, postVideo, postCarousels, pubItems, openEdit, setTab }) {
  return (
    <div style={{borderBottom:"1px solid #1a1a2e",background:"#0d0d16",flexShrink:0,padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:2,height:52}}>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:15,fontWeight:800,color:TABS.find(t=>t.id===tab)?.color||"#f0eee8"}}>{TABS.find(t=>t.id===tab)?.label||""}</span>
          {!["summary","analytics","base"].includes(tab)&&cnt[tab]>0&&<span style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>· {cnt[tab]}</span>}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,position:"relative"}}>
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
  );
}


// ── Fallback for lazy-loaded components ──────────────────────────────────────
function LazyFallback() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",minHeight:200,color:"#4b5563",fontSize:12,fontFamily:"monospace",gap:8}}>
      <style>{`@keyframes vg-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:16,height:16,border:"2px solid #2d2d44",borderTopColor:"#8b5cf6",borderRadius:"50%",animation:"vg-spin 0.8s linear infinite"}}/>
      загрузка...
    </div>
  );
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
  // ── Data store — useReducer prevents 7 separate re-renders on load ────────────
  const [data, dispatch] = useReducer((state, action) => {
    switch (action.type) {
      case "LOAD_ALL": return { ...state, ...action.payload, loading: false };
      case "SET_PROJECTS": return { ...state, projects: action.payload };
      case "SET_TEAM": return { ...state, teamMembers: action.payload };
      case "SET_KPIS": return { ...state, kpis: action.payload };
      case "SET_TASKS": return { ...state, [action.taskType]: action.payload };
      case "UPDATE_TASK": return { ...state, [action.taskType]: state[action.taskType].map(x => x.id === action.id ? { ...x, ...action.patch } : x) };
      case "ADD_TASK": return { ...state, [action.taskType]: [...state[action.taskType], action.item] };
      case "REMOVE_TASK": return { ...state, [action.taskType]: state[action.taskType].filter(x => x.id !== action.id) };
      default: return state;
    }
  }, {
    projects: [], teamMembers: [], kpis: {},
    preItems: [], prodItems: [], postReels: [], postVideo: [],
    postCarousels: [], pubItems: [], adminItems: [],
    loading: true,
  });

  const { projects, teamMembers, kpis, preItems, prodItems, postReels, postVideo, postCarousels, pubItems, adminItems, loading } = data;

  // Setters — wrap dispatch for backward compat with existing code
  const setProjects     = p => dispatch({ type: "SET_PROJECTS", payload: typeof p === "function" ? p(projects) : p });
  const setTeamMembers  = p => dispatch({ type: "SET_TEAM",     payload: typeof p === "function" ? p(teamMembers) : p });
  const setKpis         = p => dispatch({ type: "SET_KPIS",     payload: typeof p === "function" ? p(kpis) : p });
  const makeTaskSetter  = (taskType, current) => p => dispatch({ type: "SET_TASKS", taskType, payload: typeof p === "function" ? p(current) : p });
  const setPreItems     = makeTaskSetter("preItems",     preItems);
  const setProdItems    = makeTaskSetter("prodItems",    prodItems);
  const setPostReels    = makeTaskSetter("postReels",    postReels);
  const setPostVideo    = makeTaskSetter("postVideo",    postVideo);
  const setPostCarousels= makeTaskSetter("postCarousels",postCarousels);
  const setPubItems     = makeTaskSetter("pubItems",     pubItems);
  const setAdminItems   = makeTaskSetter("adminItems",   adminItems);

  const [modal,setModal]=useState(null);
  const saveFnRef = useRef(null);
  const stores = {preItems,setPreItems,prodItems,setProdItems,postReels,setPostReels,postVideo,setPostVideo,postCarousels,setPostCarousels,pubItems,setPubItems,adminItems,setAdminItems};
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
          api.getTasks({ archived: "false" }), // active only — archived loaded on demand
        ]);
        // Single dispatch — one re-render instead of 7
        const expand = t => {
          const d = t.data || {};
          return {
            id: t.id, project: t.project_id, status: t.status, title: t.title, type: t.type,
            completed_at: t.completed_at || "", starred: t.starred || false, chat: [],
            refs: d.refs || [], equipment: d.equipment || [], actors: d.actors || [],
            checklist: d.checklist || [], source_links: d.source_links || [], slides: d.slides || [],
            ...d,
            archived: t.archived || false,
          };
        };
        dispatch({ type: "LOAD_ALL", payload: {
          projects:      projs.map(p => ({...p, links: p.links || [], archived: p.archived || false})),
          teamMembers:   users.map(u => ({...u, note: u.note || ""})),
          preItems:      tasks.filter(t=>t.type==="pre").map(expand),
          prodItems:     tasks.filter(t=>t.type==="prod").map(expand),
          postReels:     tasks.filter(t=>t.type==="post_reels").map(expand),
          postVideo:     tasks.filter(t=>t.type==="post_video").map(expand),
          postCarousels: tasks.filter(t=>t.type==="post_carousel").map(expand),
          pubItems:      tasks.filter(t=>t.type==="pub").map(expand),
          adminItems:    tasks.filter(t=>t.type==="admin").map(expand),
        }});
        // KPIs load separately (non-critical)
        fetch("/api/analytics/kpi").then(r=>r.ok?r.json():[]).then(rows=>{
          const map={}; rows.forEach(r=>{map[`${r.project_id}_${r.year}_${r.month}`]=String(r.kpi);}); setKpis(map);
        }).catch(()=>{});
      } catch(e) { console.error("Load error:", e); dispatch({ type: "LOAD_ALL", payload: {} }); }
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

  function mkCard(item, type) {
    return <TaskCard
      item={item} type={type}
      projects={projects} team={teamMembers}
      onOpen={openEdit}
      onToggleStar={toggleStar}
      onArchive={archiveTask}
      onSendToPub={(t,i) => { const isCarousel=t==="post_carousel"; setModal({type:"pub",item:defItem("pub",{title:i.title,project:i.project,pub_type:isCarousel?"carousel":"video",file_name:i.final_file_name||"",file_url:i.final_file_url||"",slides:isCarousel?(i.slides||[]):[]})});}}
    />;
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

  if(isMobile) return <Suspense fallback={<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0f",color:"#9ca3af",fontSize:12,fontFamily:"monospace"}}>🍇 загрузка...</div>}><ErrorBoundary key="mobile"><MobileApp currentUser={currentUser} onLogout={onLogout} stores={mobileStores}/></ErrorBoundary></Suspense>;

  return <div style={{fontFamily:"'Syne','Inter',sans-serif",height:"100vh",background:"#0a0a0f",color:"#f0eee8",display:"flex",overflow:"hidden"}}>
    <Sidebar tab={tab} setTab={setTab} setViewMode={setViewMode} cnt={cnt} currentUser={currentUser} onLogout={onLogout}/>

    {/* MAIN COLUMN */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
    <TopBar tab={tab} cnt={cnt} notifs={notifs} setNotifs={setNotifs} showNotifs={showNotifs} setShowNotifs={setShowNotifs} currentUser={currentUser} onLogout={onLogout} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} openEdit={openEdit} setTab={setTab}/>
    {showNotifs&&<div onClick={()=>setShowNotifs(false)} style={{position:"fixed",inset:0,zIndex:999}}/>}
    {/* CONTENT */}
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"14px 6px"}}>
      {tab==="pre"       &&<PreTab   items={filtPre}    filt={preFilt}   setFilt={setPreFilt}   viewMode={viewMode} setViewMode={setViewMode} projects={projects} team={teamMembers} openNew={openNew} openEdit={openEdit} drop={drop} showArchived={showArchivedPre}   setShowArchived={setShowArchivedPre}/>}
      {tab==="prod"      &&<ProdTab  items={filtProd}   filt={prodFilt}  setFilt={setProdFilt}  viewMode={viewMode} setViewMode={setViewMode} projects={projects} team={teamMembers} openNew={openNew} openEdit={openEdit} drop={drop} moveToDay={moveToDay} showArchived={showArchivedProd}  setShowArchived={setShowArchivedProd}/>}
      {tab==="post"      &&<PostTab  reels={filtPostReels} video={filtPostVideo} carousels={filtPostCarousels} filt={postFilt} setFilt={setPostFilt} subTab={postSubTab} setSubTab={setPostSubTab} projects={projects} team={teamMembers} openNew={openNew} drop={drop} showArchived={showArchivedPost}  setShowArchived={setShowArchivedPost}/>}
      {tab==="pub"       &&<PubTab   items={filtPub} allItems={pubItems} filt={pubFilt}  setFilt={setPubFilt}  viewMode={pubViewMode} setViewMode={setPubViewMode} projects={projects} team={teamMembers} openNew={openNew} openEdit={openEdit} drop={drop} moveToDay={moveToDay} toggleStar={toggleStar} showArchived={showArchivedPub}   setShowArchived={setShowArchivedPub}/>}
      {tab==="admin"     &&<AdminTab items={filtAdmin}  filt={adminFilt} setFilt={setAdminFilt} projects={projects} team={teamMembers} openNew={openNew} drop={drop} showArchived={showArchivedAdmin} setShowArchived={setShowArchivedAdmin}/>}
      {tab==="summary"   &&<Suspense fallback={<LazyFallback/>}><SummaryView preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems} projects={projects} team={teamMembers} currentUser={currentUser} onOpenTask={(type,item)=>openEdit(type,item)}/></Suspense>}
      {tab==="contentplan"&&<Suspense fallback={<LazyFallback/>}><div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><ContentPlanView projects={projects} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} kpisData={kpis} teamMembers={teamMembers}/></div></Suspense>}
      {tab==="analytics" &&<Suspense fallback={<LazyFallback/>}><AnalyticsView pubItems={pubItems} projects={projects} kpisData={kpis}/></Suspense>}
      {tab==="calendar"  &&<Suspense fallback={<LazyFallback/>}><div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><CalendarView projects={projects} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems||[]} onOpenTask={(type,item)=>openEdit(type,item)} onNewTask={(dateStr)=>setModal({type:"post_reels",item:{...defItem("post_reels"),post_deadline:dateStr}})}/></div></Suspense>}
      {tab==="projects"  &&<Suspense fallback={<LazyFallback/>}><div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><ProjectsView projects={projects} preItems={preItems} prodItems={prodItems} postReels={postReels} postVideo={postVideo} postCarousels={postCarousels} pubItems={pubItems} adminItems={adminItems} onOpenTask={(type,item)=>openEdit(type,item)}/></div></Suspense>}
      {tab==="board"     &&<Suspense fallback={<LazyFallback/>}><div style={{height:"calc(100vh - 48px)",overflow:"hidden"}}><IntellectBoard projects={projects} currentUser={currentUser}/></div></Suspense>}
      {tab==="base"      &&<Suspense fallback={<LazyFallback/>}><ErrorBoundary key="base"><BaseView projects={projects} setProjects={setProjects} teamMembers={teamMembers} setTeamMembers={setTeamMembers} currentUser={currentUser}/></ErrorBoundary></Suspense>}
    </div>

    {/* MODALS */}
    <Suspense fallback={<LazyFallback/>}>
    {modal?.type==="pre"          &&<Modal title="Препродакшн — Сценарий"  color="#8b5cf6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pre",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PreForm          item={modal.item} onSave={d=>save("pre",d)} onDelete={id=>deleteTask("pre",id)}           onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="prod"         &&<Modal title="Продакшн — Съёмка"       color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("prod",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><ProdForm         item={modal.item} onSave={d=>save("prod",d)} onDelete={id=>deleteTask("prod",id)}          onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="post_reels"   &&<Modal title="Постпродакшн — Рилс"    color="#ec4899" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_reels",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PostReelsForm    item={modal.item} onSave={d=>save("post_reels",d)} onDelete={id=>deleteTask("post_reels",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_reels",d)}/></Modal>}
    {modal?.type==="post_video"   &&<Modal title="Постпродакшн — Видео"    color="#3b82f6" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_video",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PostVideoForm    item={modal.item} onSave={d=>save("post_video",d)} onDelete={id=>deleteTask("post_video",id)}    onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef} onSendToPub={d=>sendToPub("post_video",d)}/></Modal>}
    {modal?.type==="post_carousel"&&<Modal title="Постпродакшн — Карусель" color="#a78bfa" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("post_carousel",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PostCarouselForm item={modal.item} onSave={d=>save("post_carousel",d)} onDelete={id=>deleteTask("post_carousel",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} onSendToPub={d=>sendToPub("post_carousel",d)}/></Modal>}
    {modal?.type==="admin"        &&<Modal title="Административная задача" color="#f97316" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("admin",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><AdminForm item={modal.item} onSave={d=>save("admin",d)} onDelete={id=>deleteTask("admin",id)} onClose={close} projects={projects} team={teamMembers} currentUser={currentUser} saveFnRef={saveFnRef}/></Modal>}
    {modal?.type==="pub"          &&<Modal title="Публикация"               color="#10b981" onClose={close} onSave={()=>saveFnRef.current?.()} onDelete={modal.item?.id?()=>deleteTask("pub",modal.item.id):undefined} taskId={modal.item?.id} team={teamMembers} currentUser={currentUser}><PubForm          item={modal.item} onSave={d=>save("pub",d)} onDelete={id=>deleteTask("pub",id)}           onClose={close} saveFnRef={saveFnRef} projects={projects} team={teamMembers} currentUser={currentUser}/></Modal>}
    </Suspense>
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

