import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId, stColor, teamOf } from "../../utils/helpers";
import { api } from "../../api";
import { Field, StatusRow, TeamSelect, FilterBar } from "../ui";
import Modal from "../modal/Modal";
import { MTag, MStatusBadge, MAvatar, MTaskCard, MPubCard } from "./MobileUI";

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

export default MTasksScreen;
