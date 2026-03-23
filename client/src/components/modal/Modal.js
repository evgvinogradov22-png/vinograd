import React, { useState, useRef, useEffect } from "react";
import MiniChat from "../chat/MiniChat";

function Modal({title,color,onClose,onSave,onDelete,children,taskId,team,currentUser}){
  const [confirmDel,setConfirmDel]=useState(false);
  const onCloseRef=useRef(onClose);
  useEffect(()=>{onCloseRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onCloseRef.current();};
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.87)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:16,
        width:"min(1100px,97vw)",height:"min(88vh,860px)",
        display:"flex",flexDirection:"column",
        boxShadow:"0 40px 80px rgba(0,0,0,0.8)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"10px 16px",borderBottom:"1px solid #1e1e2e",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{flex:1,fontSize:13,fontWeight:800,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          {onDelete&&!confirmDel&&<button onClick={()=>setConfirmDel(true)} title="Удалить" style={{background:"transparent",border:"1px solid #ef444450",borderRadius:7,padding:"5px 10px",color:"#ef4444",cursor:"pointer",fontSize:12}}>🗑</button>}
          {onDelete&&confirmDel&&<><button onClick={()=>{setConfirmDel(false);onDelete();}} style={{background:"#ef4444",border:"none",borderRadius:7,padding:"5px 12px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Удалить!</button><button onClick={()=>setConfirmDel(false)} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 8px",color:"#9ca3af",cursor:"pointer",fontSize:11}}>✕</button></>}
          {onSave&&<button onClick={onSave} style={{background:`linear-gradient(135deg,${color},${color}bb)`,border:"none",borderRadius:7,padding:"5px 16px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>💾 Сохранить</button>}
          <button onClick={onClose} style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:6,width:26,height:26,cursor:"pointer",color:"#9ca3af",fontSize:14,flexShrink:0}}>×</button>
        </div>

        {/* Body: left = form, right = chat */}
        <div style={{flex:1,display:"flex",minHeight:0}}>
          {/* Left — form */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 18px",isolation:"isolate",minWidth:0}}>
            {children}
          </div>

          {/* Right — chat */}
          {taskId && <div style={{
            width:360,flexShrink:0,
            borderLeft:"1px solid #1e1e2e",
            display:"flex",flexDirection:"column",
            borderRadius:"0 0 16px 0",
            overflow:"hidden",
          }}>
            <MiniChat taskId={taskId} team={team} currentUser={currentUser} embedded/>
          </div>}
        </div>
      </div>
    </div>
  );
}

export default Modal;
