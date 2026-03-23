import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";
import { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard } from "./MobileUI";
import MTasksScreen from "./MTasksScreen";
import MPubScreen from "./MPubScreen";
import MAnalyticsScreen from "./MAnalyticsScreen";
import MSummaryScreen from "./MSummaryScreen";
import MBaseScreen from "./MBaseScreen";

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

export default MobileApp;
