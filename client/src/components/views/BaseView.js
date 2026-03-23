import React, { useState, useRef, useEffect } from "react";
import { SI, LB, TABS, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";
import { Kanban, CalView, WeekView } from "../kanban";

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

export { BaseView, BaseProjectsView, TrainingView, ProjectCard, TeamView };
