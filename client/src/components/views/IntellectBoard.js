import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES, MONTHS, WDAYS, pubCount, ROLES_LIST, AVATAR_COLORS, TABS } from "../../constants";
import { cleanR2Url, isR2Url, fileHref, xhrUpload } from "../../utils/files";
import { genId, teamOf, projOf, stColor } from "../../utils/helpers";
import { api } from "../../api";
import { Field, Btn, StatusRow, FilterBar, TeamSelect, UploadProgress, TzField } from "../ui";

function IntellectBoard({ projects, currentUser }) {
  const [stickers, setStickers] = useState([]);
  const [arrows,   setArrows]   = useState([]);
  const [scale,    setScale]    = useState(1);
  const [pan,      setPan]      = useState({ x: 60, y: 60 });
  const [loading,  setLoading]  = useState(true);
  const [mode,     setMode]     = useState("select"); // "select" | "arrow"
  const [arrowStart, setArrowStart] = useState(null);
  const [dragging,   setDragging]   = useState(null);
  const [resizing,   setResizing]   = useState(null);
  const [panning,    setPanning]    = useState(null);
  const [editing,    setEditing]    = useState(null);
  const [hoverArrow, setHoverArrow] = useState(null);
  const boardRef    = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const MIN_W = 140, MIN_H = 100;

  // ── Load ──
  useEffect(() => {
    Promise.all([
      fetch("/api/stickers").then(r=>r.json()).catch(()=>[]),
      fetch("/api/sticker-arrows").then(r=>r.json()).catch(()=>[]),
    ]).then(([s,a])=>{ setStickers(Array.isArray(s)?s:[]); setArrows(Array.isArray(a)?a:[]); setLoading(false); });
  }, []);

  const projOf  = id => projects.find(p=>p.id===id);
  const colorOf = id => projOf(id)?.color || "#a78bfa";

  // ── Add sticker ──
  function addSticker() {
    const id  = genId();
    const proj = projects.find(p=>!p.archived) || projects[0];
    const rot  = (Math.random()-0.5)*3;
    // Place in visible area center
    const cx = (boardRef.current?.clientWidth/2  || 400) / scale - pan.x/scale;
    const cy = (boardRef.current?.clientHeight/2 || 300) / scale - pan.y/scale;
    const s = { id, project_id:proj?.id||"all", text:"", color:proj?.color||"#a78bfa",
      x:Math.max(10,cx-100+Math.random()*80-40),
      y:Math.max(10,cy-80 +Math.random()*60-30),
      w:200, h:160, rot, author_id:currentUser?.id||"" };
    setStickers(p=>[...p,s]);
    setEditing(id);
    fetch("/api/stickers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)}).catch(()=>{});
  }

  // ── Patch / delete ──
  function patchS(id, patch) {
    setStickers(p=>p.map(s=>s.id===id?{...s,...patch}:s));
    fetch(`/api/stickers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}).catch(()=>{});
  }
  function delS(id) {
    setStickers(p=>p.filter(s=>s.id!==id));
    setArrows(p=>p.filter(a=>a.from!==id&&a.to!==id));
    fetch(`/api/stickers/${id}`,{method:"DELETE"}).catch(()=>{});
    fetch(`/api/sticker-arrows/by-sticker/${id}`,{method:"DELETE"}).catch(()=>{});
  }
  function delArrow(id) {
    setArrows(p=>p.filter(a=>a.id!==id));
    fetch(`/api/sticker-arrows/${id}`,{method:"DELETE"}).catch(()=>{});
  }

  // ── Zoom ──
  function zoom(delta, cx, cy) {
    setScale(prev => {
      const next = Math.min(3, Math.max(0.15, prev * delta));
      if (cx!=null && cy!=null) {
        setPan(p => ({
          x: cx - (cx - p.x) * (next/prev),
          y: cy - (cy - p.y) * (next/prev),
        }));
      }
      return next;
    });
  }

  // ── Wheel zoom (cursor-centered) ──
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      zoom(e.deltaY < 0 ? 1.1 : 0.9, cx, cy);
    };
    el.addEventListener("wheel", onWheel, {passive:false});
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale]);

  // ── Mouse events ──
  function onBoardDown(e) {
    if (e.button === 1) { e.preventDefault(); setPanning({sx:e.clientX,sy:e.clientY,ox:pan.x,oy:pan.y}); return; }
    if (e.button === 0 && mode==="select") {
      const tgt = e.target;
      if (tgt===boardRef.current || tgt.dataset.bg) {
        setPanning({sx:e.clientX,sy:e.clientY,ox:pan.x,oy:pan.y});
      }
    }
  }
  function onStickerDown(e, s) {
    if (mode==="arrow" || e.target.closest(".stk-ctrl") || e.target.closest(".stk-rsz") || e.target.tagName==="TEXTAREA" || e.target.tagName==="SELECT") return;
    e.preventDefault(); e.stopPropagation();
    setDragging({id:s.id,sx:e.clientX,sy:e.clientY,ox:s.x,oy:s.y});
  }
  function onResizeDown(e, s) {
    e.preventDefault(); e.stopPropagation();
    setResizing({id:s.id,sx:e.clientX,sy:e.clientY,ow:s.w,oh:s.h});
  }
  function onStickerClick(e, s) {
    if (mode!=="arrow") return;
    e.stopPropagation();
    if (!arrowStart) { setArrowStart(s.id); return; }
    if (arrowStart===s.id) { setArrowStart(null); return; }
    const exists = arrows.find(a=>(a.from===arrowStart&&a.to===s.id)||(a.from===s.id&&a.to===arrowStart));
    if (exists) { delArrow(exists.id); }
    else {
      const id=genId(); const arr={id,from:arrowStart,to:s.id};
      setArrows(p=>[...p,arr]);
      fetch("/api/sticker-arrows",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(arr)}).catch(()=>{});
    }
    setArrowStart(null);
  }

  useEffect(() => {
    function onMove(e) {
      if (dragging) {
        const dx=(e.clientX-dragging.sx)/scale, dy=(e.clientY-dragging.sy)/scale;
        setStickers(p=>p.map(s=>s.id===dragging.id?{...s,x:Math.max(0,dragging.ox+dx),y:Math.max(0,dragging.oy+dy)}:s));
      }
      if (resizing) {
        const dx=(e.clientX-resizing.sx)/scale, dy=(e.clientY-resizing.sy)/scale;
        setStickers(p=>p.map(s=>s.id===resizing.id?{...s,w:Math.max(MIN_W,resizing.ow+dx),h:Math.max(MIN_H,resizing.oh+dy)}:s));
      }
      if (panning) setPan({x:panning.ox+(e.clientX-panning.sx),y:panning.oy+(e.clientY-panning.sy)});
    }
    function onUp() {
      if (dragging) { const s=stickers.find(x=>x.id===dragging.id); if(s) patchS(s.id,{x:s.x,y:s.y}); setDragging(null); }
      if (resizing) { const s=stickers.find(x=>x.id===resizing.id); if(s) patchS(s.id,{w:s.w,h:s.h}); setResizing(null); }
      if (panning) setPanning(null);
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
    return ()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[dragging,resizing,panning,stickers,scale]);

  // ── Arrow geometry ──
  function arrowPath(a) {
    const f=stickers.find(s=>s.id===a.from), t=stickers.find(s=>s.id===a.to);
    if(!f||!t) return null;
    const fx=f.x+f.w/2, fy=f.y+f.h/2, tx=t.x+t.w/2, ty=t.y+t.h/2;
    const dx=tx-fx, dy=ty-fy;
    const d=`M${fx},${fy} C${fx+dx*0.4-dy*0.15},${fy+dy*0.4+dx*0.15} ${tx-dx*0.4+dy*0.15},${ty-dy*0.4-dx*0.15} ${tx},${ty}`;
    return {d, id:a.id, color:colorOf(f.project_id)};
  }

  const arrowPaths = arrows.map(arrowPath).filter(Boolean);

  // ── Minimap ──
  const MM_W=160, MM_H=100;
  const mmScaleX=MM_W/BOARD_W, mmScaleY=MM_H/BOARD_H;
  const vpW=(boardRef.current?.clientWidth||800)/scale;
  const vpH=(boardRef.current?.clientHeight||600)/scale;
  const vpX=-pan.x/scale, vpY=-pan.y/scale;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 48px)",background:"#07070f",overflow:"hidden",position:"relative"}}>

      {/* ── Toolbar ── */}
      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:"1px solid #1a1a2e",background:"#0d0d16"}}>
        <span style={{fontSize:14,fontWeight:800,color:"#f0eee8",marginRight:2}}>🧠 Интелект-доска</span>

        <div style={{display:"flex",background:"#111118",borderRadius:8,border:"1px solid #1e1e2e",overflow:"hidden"}}>
          {[["select","☝️ Выбор"],["arrow","↗️ Стрелка"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setArrowStart(null);}}
              style={{padding:"5px 13px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,
                background:mode===m?"#1e1e2e":"transparent",color:mode===m?"#f0eee8":"#4b5563"}}>{l}</button>
          ))}
        </div>

        {arrowStart&&<span style={{fontSize:11,color:"#f59e0b",fontFamily:"monospace"}}>⬤ Выберите второй стикер...</span>}
        <div style={{flex:1}}/>

        <button onClick={addSticker}
          style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",border:"none",borderRadius:9,
            padding:"7px 18px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
          + Стикер
        </button>
      </div>

      {/* ── Canvas ── */}
      <div ref={boardRef} onMouseDown={onBoardDown}
        onMouseMove={e=>{const r=boardRef.current?.getBoundingClientRect();if(r)mousePosRef.current={x:e.clientX-r.left,y:e.clientY-r.top};}}
        style={{flex:1,position:"relative",overflow:"hidden",
          cursor:panning?"grabbing":mode==="arrow"?"crosshair":"default",
          backgroundImage:`radial-gradient(circle, #1e1e2e 1px, transparent 1px)`,
          backgroundSize:`${28*scale}px ${28*scale}px`,
          backgroundPosition:`${pan.x%( 28*scale)}px ${pan.y%(28*scale)}px`,
        }}>
        <div data-bg="1" style={{position:"absolute",inset:0}}/>

        {/* Scaled world */}
        <div style={{position:"absolute",left:pan.x,top:pan.y,
          transform:`scale(${scale})`,transformOrigin:"0 0",width:BOARD_W,height:BOARD_H}}>

          {/* SVG arrows */}
          <svg style={{position:"absolute",inset:0,width:BOARD_W,height:BOARD_H,overflow:"visible",pointerEvents:"none"}}>
            <defs>
              {arrowPaths.map(a=>(
                <marker key={a.id} id={`ah${a.id}`} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L9,3.5 z" fill={a.color} opacity="0.9"/>
                </marker>
              ))}
            </defs>
            {arrowPaths.map(a=>(
              <g key={a.id} style={{pointerEvents:"all"}}
                onMouseEnter={()=>setHoverArrow(a.id)} onMouseLeave={()=>setHoverArrow(null)}
                onClick={()=>delArrow(a.id)} style={{cursor:"pointer",pointerEvents:"all"}}>
                <path d={a.d} fill="none" stroke={a.color} strokeWidth={hoverArrow===a.id?4:2.5} opacity={hoverArrow===a.id?1:0.7} markerEnd={`url(#ah${a.id})`}/>
                <path d={a.d} fill="none" stroke="transparent" strokeWidth="14"/>
              </g>
            ))}
          </svg>

          {/* Stickers */}
          {stickers.map(s=>{
            const isDrag=dragging?.id===s.id;
            const isResize=resizing?.id===s.id;
            const isArrowSrc=arrowStart===s.id;
            const p=projOf(s.project_id);
            const c=p?.color||"#a78bfa";
            return (
              <div key={s.id}
                onMouseDown={e=>onStickerDown(e,s)}
                onClick={e=>onStickerClick(e,s)}
                style={{
                  position:"absolute",left:s.x,top:s.y,width:s.w,height:s.h,
                  background:`linear-gradient(160deg, ${c}f0 0%, ${c}cc 100%)`,
                  borderRadius:"3px 14px 12px 3px",
                  boxShadow:isDrag
                    ?`0 28px 50px rgba(0,0,0,0.65),3px 3px 0 rgba(0,0,0,0.2)`
                    :`3px 5px 14px rgba(0,0,0,0.5),2px 2px 0 rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.2)`,
                  cursor:mode==="arrow"?"crosshair":isDrag?"grabbing":"grab",
                  display:"flex",flexDirection:"column",
                  transform:isDrag?`rotate(${(s.rot||0)+2}deg) scale(1.05) translateY(-4px)`:`rotate(${s.rot||0}deg)`,
                  transition:isDrag||isResize?"none":"box-shadow 0.15s,transform 0.2s",
                  zIndex:isDrag||editing===s.id?300:isArrowSrc?200:1,
                  userSelect:"none",
                }}>

                {/* Fold corner */}
                <div style={{position:"absolute",top:0,right:0,width:20,height:20,
                  background:`linear-gradient(225deg,rgba(0,0,0,0.22) 50%,transparent 50%)`,
                  borderRadius:"0 14px 0 0",pointerEvents:"none"}}/>

                {/* Arrow highlight ring */}
                {mode==="arrow"&&<div style={{position:"absolute",inset:0,borderRadius:"3px 14px 12px 3px",
                  border:`2.5px solid ${isArrowSrc?"#fff":"rgba(255,255,255,0.35)"}`,
                  boxShadow:isArrowSrc?"0 0 16px #fffa":"none",pointerEvents:"none"}}/>}

                {/* Header */}
                <div className="stk-ctrl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"6px 8px 3px",flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:"rgba(0,0,0,0.3)",flexShrink:0}}/>
                    <select value={s.project_id}
                      onChange={e=>{const np=projects.find(x=>x.id===e.target.value);patchS(s.id,{project_id:e.target.value,color:np?.color||"#a78bfa"});}}
                      onClick={e=>e.stopPropagation()}
                      onMouseDown={e=>e.stopPropagation()}
                      style={{background:"transparent",border:"none",outline:"none",fontSize:9,color:"rgba(0,0,0,0.5)",
                        cursor:"pointer",fontFamily:"inherit",fontWeight:700,maxWidth:80,
                        WebkitAppearance:"none",appearance:"none"}}>
                      {projects.filter(x=>!x.archived).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </div>
                  {/* Delete button — always visible */}
                  <button
                    onMouseDown={e=>e.stopPropagation()}
                    onClick={e=>{e.stopPropagation();delS(s.id);}}
                    style={{background:"rgba(0,0,0,0.18)",border:"none",borderRadius:6,
                      width:20,height:20,cursor:"pointer",fontSize:14,
                      color:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",
                      justifyContent:"center",lineHeight:1,flexShrink:0,fontWeight:700}}>×</button>
                </div>

                {/* Text */}
                <div style={{flex:1,padding:"2px 10px 8px",overflow:"hidden"}}>
                  {editing===s.id?(
                    <textarea autoFocus value={s.text}
                      onMouseDown={e=>e.stopPropagation()}
                      onChange={e=>setStickers(p=>p.map(x=>x.id===s.id?{...x,text:e.target.value}:x))}
                      onBlur={()=>{patchS(s.id,{text:stickers.find(x=>x.id===s.id)?.text||""});setEditing(null);}}
                      style={{width:"100%",height:"100%",background:"transparent",border:"none",outline:"none",
                        resize:"none",fontSize:13,color:"rgba(0,0,0,0.78)",fontFamily:"inherit",lineHeight:1.55}}/>
                  ):(
                    <div onClick={e=>{if(mode!=="arrow"){e.stopPropagation();setEditing(s.id);}}}
                      style={{width:"100%",height:"100%",fontSize:13,lineHeight:1.55,
                        whiteSpace:"pre-wrap",wordBreak:"break-word",cursor:"text",
                        color:s.text?"rgba(0,0,0,0.78)":"rgba(0,0,0,0.32)",fontStyle:s.text?"normal":"italic"}}>
                      {s.text||"Нажмите чтобы написать..."}
                    </div>
                  )}
                </div>

                {/* Resize handle */}
                <div className="stk-rsz" onMouseDown={e=>onResizeDown(e,s)}
                  style={{position:"absolute",bottom:0,right:0,width:20,height:20,
                    cursor:"nwse-resize",display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:4}}>
                  <svg width="10" height="10"><path d="M1 10L10 1M5 10L10 5" stroke="rgba(0,0,0,0.25)" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>
              </div>
            );
          })}
        </div>

        {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#4b5563",fontSize:13}}>⏳ Загрузка...</div>}
        {!loading&&stickers.length===0&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#2d2d44",pointerEvents:"none"}}>
            <div style={{fontSize:52,marginBottom:12}}>🧠</div>
            <div style={{fontSize:14,fontWeight:700}}>Доска пуста</div>
            <div style={{fontSize:11,marginTop:6}}>Нажмите «+ Стикер» чтобы начать</div>
          </div>
        )}

        {/* ── Zoom panel (right side) ── */}
        <div style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",
          display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:14,padding:"10px 8px",
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
          <button onClick={()=>zoom(1.2, mousePosRef.current.x, mousePosRef.current.y)}
            style={{width:34,height:34,borderRadius:9,background:"#1e1e2e",border:"1px solid #2d2d44",
              color:"#f0eee8",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>+</button>
          <span style={{fontSize:10,color:"#4b5563",fontFamily:"monospace",writingMode:"horizontal-tb",minWidth:30,textAlign:"center"}}>
            {Math.round(scale*100)}%
          </span>
          <button onClick={()=>zoom(0.83, mousePosRef.current.x, mousePosRef.current.y)}
            style={{width:34,height:34,borderRadius:9,background:"#1e1e2e",border:"1px solid #2d2d44",
              color:"#f0eee8",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>−</button>
          <div style={{width:24,height:1,background:"#1e1e2e",margin:"2px 0"}}/>
          <button onClick={()=>{setScale(1);setPan({x:60,y:60});}}
            title="Сбросить"
            style={{width:34,height:34,borderRadius:9,background:"#111118",border:"1px solid #1e1e2e",
              color:"#4b5563",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>⌖</button>
        </div>

        {/* ── Minimap ── */}
        <div style={{position:"absolute",right:16,bottom:16,
          width:MM_W,height:MM_H,background:"#0a0a14",
          border:"1px solid #1e1e2e",borderRadius:10,overflow:"hidden",
          boxShadow:"0 4px 20px rgba(0,0,0,0.6)"}}>
          <svg width={MM_W} height={MM_H} style={{display:"block"}}>
            {/* Stickers in minimap */}
            {stickers.map(s=>{
              const c=colorOf(s.project_id);
              return <rect key={s.id}
                x={s.x*mmScaleX} y={s.y*mmScaleY}
                width={Math.max(4,s.w*mmScaleX)} height={Math.max(3,s.h*mmScaleY)}
                rx="1" fill={c} opacity="0.75"/>;
            })}
            {/* Arrows in minimap */}
            {arrowPaths.map(a=>{
              const scaled = a.d.replace(/([\d.]+),([\d.]+)/g, (_,x,y)=>`${parseFloat(x)*mmScaleX},${parseFloat(y)*mmScaleY}`);
              return <path key={a.id} d={scaled} fill="none" stroke={a.color} strokeWidth="1" opacity="0.5"/>;
            })}
            {/* Viewport rect */}
            <rect
              x={Math.max(0,vpX*mmScaleX)} y={Math.max(0,vpY*mmScaleY)}
              width={Math.min(MM_W,vpW*mmScaleX)} height={Math.min(MM_H,vpH*mmScaleY)}
              fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.4" rx="1"/>
          </svg>
          <div style={{position:"absolute",bottom:3,left:5,fontSize:8,color:"#2d2d44",fontFamily:"monospace",pointerEvents:"none"}}>minimap</div>
        </div>
      </div>
    </div>
  );
}

export default IntellectBoard;
