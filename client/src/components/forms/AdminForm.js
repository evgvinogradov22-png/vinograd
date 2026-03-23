import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";

function AdminForm({item, onSave, onDelete, onClose, projects, team, currentUser, saveFnRef}) {
  const { d, u } = useTaskForm({status:"new", priority:"normal", ...item}, saveFnRef, onSave);
  const u = (k,v) => setD(p => ({...p, [k]:v}));
  return <div style={{display:"flex",flexDirection:"column",gap:11}}>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:1}}>
        <label style={LB}>НАЗВАНИЕ</label>
        <input value={d.title||""} onChange={e=>u("title",e.target.value)} style={SI} placeholder="Название задачи"/>
      </div>
      <div style={{width:160}}>
        <label style={LB}>ПРОЕКТ</label>
        <select value={d.project||""} onChange={e=>u("project",e.target.value)} style={SI}>
          <option value="">— без проекта —</option>
          {projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
    </div>
    <StatusRow statuses={ADMIN_STATUSES} value={d.status} onChange={v=>u("status",v)}/>
    <div style={{display:"flex",gap:10}}>
      <div style={{flex:1}}>
        <label style={LB}>ДЕДЛАЙН</label>
        <input type="date" value={d.deadline||""} onChange={e=>u("deadline",e.target.value)} style={SI}/>
      </div>
      <div style={{flex:1}}>
        <label style={LB}>ПРИОРИТЕТ</label>
        <select value={d.priority||"normal"} onChange={e=>u("priority",e.target.value)} style={SI}>
          <option value="low">Низкий</option>
          <option value="normal">Обычный</option>
          <option value="high">Высокий</option>
          <option value="urgent">Срочно</option>
        </select>
      </div>
    </div>
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:8,fontWeight:700}}>УЧАСТНИКИ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <div style={{fontSize:9,color:"#8b5cf6",fontFamily:"monospace",marginBottom:4}}>◀ ЗАКАЗЧИК</div>
          <TeamSelect label="" value={d.customer||""} onChange={v=>u("customer",v)} team={team}/>
        </div>
        <div>
          <div style={{fontSize:9,color:"#10b981",fontFamily:"monospace",marginBottom:4,textAlign:"right"}}>ИСПОЛНИТЕЛЬ ▶</div>
          <TeamSelect label="" value={d.executor||""} onChange={v=>u("executor",v)} team={team}/>
        </div>
      </div>
    </div>
    <div>
      <label style={LB}>ТЗ / ОПИСАНИЕ</label>
      <textarea value={d.description||""} onChange={e=>u("description",e.target.value)}
        placeholder="Подробное описание задачи..."
        style={{...SI, minHeight:90, resize:"vertical", lineHeight:1.5}}/>
    </div>
    <SaveRow onClose={onClose} onSave={()=>onSave(d)} onDelete={item?.id ? ()=>onDelete(item.id) : undefined}/>
  </div>;
}

export default AdminForm;
