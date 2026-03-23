import React, { useState, useRef, useEffect } from "react";
import { SI } from "../../constants";
import { cleanR2Url, xhrUpload } from "../../utils/files";
import { genId, teamOf } from "../../utils/helpers";

function MiniChat({taskId, team, currentUser, embedded=false}){
  const [msgs,     setMsgs]   = useState([]);
  const [text,     setText]   = useState("");
  const [uploading,setUploading] = useState(false); // bool
  const [uploadPct,setUploadPct] = useState(0);     // 0-100
  const [uploadName,setUploadName] = useState("");
  const [err,      setErr]    = useState("");
  const [showM,    setShowM]  = useState(false);
  const [mentionQ, setMentionQ] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSec,    setRecSec]    = useState(0);
  const bottomRef = useRef(null);
  const fileRef   = useRef(null);
  const inputRef  = useRef(null);
  const mediaRecRef  = useRef(null);
  const recChunksRef = useRef([]);
  const recTimerRef  = useRef(null);
  const myId = currentUser?.id || "";
  const nm   = id => { try { return teamOf(id, team)?.name || "?"; } catch(e) { return "?"; } };

  // load history
  useEffect(() => {
    if (!taskId || taskId === "undefined") return;
    fetch(`/api/chat/${taskId}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        if (!Array.isArray(rows)) return;
        setMsgs(rows.map(r => ({
          id:    r.id    || genId(),
          user:  r.user_id || "",
          text:  r.text  || "",
          ts:    r.created_at || Date.now(),
          fname: r.file_name || "",
          furl:  cleanR2Url(r.file_url  || ""),
          isLog: r.file_name === "__log__",
        })));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
      })
      .catch(() => {});
  }, [taskId]);

  // send text
  async function send() {
    const t = text.trim(); if (!t) return;
    if (!taskId || taskId === "undefined") { setErr("Сначала сохраните задачу"); return; }
    setText(""); setShowM(false);
    try {
      const r = await fetch(`/api/chat/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: myId, text: t, file_url: "", file_name: "" }),
      });
      if (!r.ok) throw new Error(await r.text());
      const m = await r.json();
      setMsgs(p => [...p, { id: m.id||genId(), user: m.user_id||myId, text: m.text||t, ts: m.created_at||Date.now(), fname: "", furl: "", isLog: m.file_name==="__log__" }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    } catch(e) { setErr("Ошибка: " + e.message); }
  }

  // upload with REAL progress via XMLHttpRequest
  function handleFiles(e) {
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (!files.length) return;
    if (!taskId || taskId === "undefined") { setErr("Сначала сохраните задачу"); return; }
    setErr("");
    uploadNext(files, 0);
  }

  async function uploadNext(files, i) {
    if (i >= files.length) return;
    const f = files[i];
    setUploading(true); setUploadPct(0); setUploadName(f.name);
    try {
      // Use unified xhrUpload — presigned PUT direct to R2
      const { url: dlurl } = await xhrUpload(f, p => setUploadPct(Math.round(p * 0.9)));
      setUploadPct(95);
      const msgR = await fetch(`/api/chat/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: myId, text: "", file_url: dlurl, file_name: f.name }),
      });
      if (!msgR.ok) throw new Error(await msgR.text());
      const m = await msgR.json();
      setUploadPct(100);
      setMsgs(p => [...p, { id: m.id||genId(), user: m.user_id||myId, text: "", ts: m.created_at||Date.now(), fname: f.name, furl: cleanR2Url(dlurl||"") }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    } catch(e) { setErr("Ошибка загрузки: " + e.message); }
    setTimeout(() => { setUploading(false); setUploadPct(0); setUploadName(""); uploadNext(files, i + 1); }, 800);
  }

  // ── Voice recording ──────────────────────────────────────────────────────────
  async function startRec() {
    if (recording) return;
    if (!taskId || taskId === "undefined") { setErr("Сохраните задачу перед отправкой голосового"); return; }
    setErr("");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch(e) { setErr("Нет доступа к микрофону: " + e.message); return; }

    const chunks = [];
    let mr;
    try { mr = new MediaRecorder(stream); }
    catch(e) { stream.getTracks().forEach(t=>t.stop()); setErr("MediaRecorder недоступен"); return; }

    mr.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(recTimerRef.current);
      setRecording(false); setRecSec(0);
      if (!chunks.length) { setErr("Запись пустая"); return; }
      const mimeType = mr.mimeType || "audio/webm";
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const fname = "voice_" + Date.now() + "." + ext;
      const blob = new Blob(chunks, { type: mimeType });
      setUploading(true); setUploadName("🎙️ Отправляю...");
      try {
        // Step 1: get presigned URL (fast, just a server call)
        const ps = await fetch("/api/presign-upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fname, type: "audio/" + ext })
        });
        if (!ps.ok) throw new Error("presign " + ps.status);
        const { presignedUrl, url: fileUrl, key } = await ps.json();
        // Step 2: PUT blob directly to R2 (no Railway bottleneck)
        const put = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": "audio/" + ext },
          body: blob
        });
        if (!put.ok) throw new Error("put " + put.status);
        const playUrl = `/api/download?key=${encodeURIComponent(key)}&name=${encodeURIComponent(fname)}`;
        // Step 3: save message
        const rc = await fetch(`/api/chat/${taskId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: myId, text: "", file_url: fileUrl, file_name: fname })
        });
        if (!rc.ok) throw new Error("chat " + rc.status);
        const m = await rc.json();
        setMsgs(p => [...p, { id: m.id||genId(), user: m.user_id||myId, text: "", ts: m.created_at||Date.now(), fname, furl: fileUrl, playUrl, isVoice: true }]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      } catch(e) { setErr("Ошибка: " + e.message); }
      setUploading(false); setUploadName("");
    };
    mr.start();
    mediaRecRef.current = mr;
    setRecording(true); setRecSec(0);
    recTimerRef.current = setInterval(() => setRecSec(s => s + 1), 1000);
  }
  function stopRec() {
    if (mediaRecRef.current && mediaRecRef.current.state === "recording") {
      mediaRecRef.current.stop();
    }
  }
  async function transcribeMsg(msgId, furl, fname) {
    setMsgs(p => p.map(m => m.id===msgId ? {...m, transcribing:true} : m));
    try {
      // Get presigned download URL so server can fetch the file
      const key = furl && furl.includes("/vinogradov/")
        ? "vinogradov/" + furl.split("/vinogradov/")[1]
        : null;
      const downloadUrl = key
        ? `/api/download?key=${encodeURIComponent(key)}&name=${encodeURIComponent(fname||"voice.webm")}`
        : furl;
      const rb = await fetch(downloadUrl);
      if (!rb.ok) throw new Error("Не удалось получить файл: " + rb.status);
      const blob = await rb.blob();
      const fd = new FormData();
      fd.append("file", new File([blob], fname||"voice.webm", { type: blob.type||"audio/webm" }));
      const tr = await fetch("/api/ai/transcribe", { method:"POST", body:fd });
      const trData = await tr.json();
      if (tr.ok && trData.text) {
        setMsgs(p => p.map(m => m.id===msgId ? {...m, transcript:trData.text, transcribing:false} : m));
        // Save transcript to server as reply
        await fetch(`/api/chat/${taskId}`, { method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({user_id:myId, text:"📝 "+trData.text}) });
      } else {
        setMsgs(p => p.map(m => m.id===msgId ? {...m, transcribing:false} : m));
        setErr("Не удалось транскрибировать");
      }
    } catch(e) { setMsgs(p => p.map(m => m.id===msgId ? {...m, transcribing:false} : m)); setErr(e.message); }
  }

  // mentions
  function onType(e) {
    const v = e.target.value; setText(v);
    const at = v.lastIndexOf("@");
    if (at >= 0 && !v.slice(at+1).includes(" ")) { setShowM(true); setMentionQ(v.slice(at+1)); }
    else setShowM(false);
  }
  function pickMention(m) {
    const at = text.lastIndexOf("@");
    setText((at >= 0 ? text.slice(0, at) : "") + "@" + m.name + " ");
    setShowM(false); inputRef.current?.focus();
  }
  const mentionList = (team||[]).filter(m => m.id !== myId && m.name.toLowerCase().includes(mentionQ.toLowerCase())).slice(0,5);

  return (
    <div style={{display:"flex",flexDirection:"column",height:embedded?"100%":300,flex:embedded?1:undefined,background:"#0d0d16",border:embedded?"none":"1px solid #1e1e2e",borderRadius:embedded?0:10,position:"relative"}}>
      {!embedded && <div style={{padding:"6px 12px",borderBottom:"1px solid #1e1e2e",fontSize:9,color:"#9ca3af",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>💬 ЧАТ</div>}
      {embedded && <div style={{padding:"8px 12px",borderBottom:"1px solid #1e1e2e",fontSize:9,color:"#4b5563",fontFamily:"monospace",fontWeight:700,letterSpacing:1,flexShrink:0}}>💬 ЧАТ</div>}

      {/* messages */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 10px",display:"flex",flexDirection:"column",gap:6,minHeight:0,justifyContent:"flex-start"}}>
        {msgs.length===0 && <div style={{textAlign:"center",color:"#6b7280",fontSize:10,paddingTop:20}}>Начните обсуждение</div>}
        {msgs.map(m => {
          // ── Log entry ──
          if (m.isLog) {
            const t = Number(m.ts);
            const timeStr = t > 1000000000 ? new Date(t).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}) : "";
            const actorName = nm(m.user);
            return <div key={m.id} style={{display:"flex",alignItems:"center",gap:4,margin:"4px 0",padding:"0 8px",minWidth:0}}>
              <div style={{flexShrink:0,width:16,height:1,background:"#1e1e2e"}}/>
              <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0,flex:1}}>
                {timeStr && <span style={{color:"#374151"}}>{timeStr} </span>}
                <span style={{color:"#6b7280"}}>{m.text}</span>
              </div>
              <div style={{flexShrink:0,width:16,height:1,background:"#1e1e2e"}}/>
            </div>;
          }
          const isMe = m.user === myId;
          const rawName = nm(m.user);
          const safeName = rawName && rawName.length > 0 ? rawName : "?";
          const ext = (m.fname||"").split(".").pop().toLowerCase();
          const fileIcon = ["jpg","jpeg","png","gif","webp"].includes(ext) ? "🖼️" : ["mp4","mov","avi","mkv","webm"].includes(ext) ? "🎬" : "📎";
          return (
            <div key={m.id} style={{display:"flex",flexDirection:isMe?"row-reverse":"row",gap:5,alignItems:"flex-end",flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"#374151",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>{safeName[0].toUpperCase()}</div>
              <div style={{maxWidth:"80%"}}>
                {!isMe && <div style={{fontSize:8,color:"#9ca3af",fontFamily:"monospace",marginBottom:2}}>@{safeName}</div>}
                <div style={{background:isMe?"#1e1630":"#1a1a2e",border:"1px solid "+(isMe?"#4c1d9530":"#2d2d44"),borderRadius:isMe?"9px 9px 3px 9px":"9px 9px 9px 3px",padding:"6px 10px"}}>
                  {m.text && <div style={{fontSize:11,color:"#f0eee8",lineHeight:1.4,wordBreak:"break-word"}}>{m.text.split(/(@[^\s]+)/g).map((p,i)=>p.startsWith("@")?<span key={i} style={{color:"#a78bfa",fontWeight:700}}>{p}</span>:p)}</div>}
                  {m.furl && (()=>{
                    const isVoiceFile = (m.fname||"").match(/\.webm$|\.ogg$|\.mp3$|\.m4a$/i) || m.isVoice;
                    if (isVoiceFile) {
                      // Use /api/download for proper audio streaming headers
                      const key = m.furl && m.furl.includes("/vinogradov/")
                        ? "vinogradov/" + m.furl.split("/vinogradov/")[1]
                        : null;
                      const audioSrc = m.playUrl || (key
                        ? `/api/download?key=${encodeURIComponent(key)}&name=${encodeURIComponent(m.fname||"voice.webm")}`
                        : m.furl);
                      return (
                      <div style={{marginTop:m.text?5:0}}>
                        <audio controls src={audioSrc} style={{width:"100%",height:32,borderRadius:6,accentColor:"#8b5cf6"}}/>
                        {m.transcript && <div style={{marginTop:5,fontSize:10,color:"#d1d5db",background:"#ffffff0a",borderRadius:5,padding:"5px 8px",lineHeight:1.4}}>📝 {m.transcript}</div>}
                        {!m.transcript && <button onClick={()=>transcribeMsg(m.id,m.furl,m.fname)} disabled={m.transcribing}
                          style={{marginTop:4,background:"transparent",border:"1px solid #4b5563",borderRadius:5,padding:"2px 8px",color:m.transcribing?"#4b5563":"#9ca3af",cursor:m.transcribing?"not-allowed":"pointer",fontSize:9,fontFamily:"monospace"}}>
                          {m.transcribing?"⏳ Транскрибирую...":"📝 Транскрибировать"}
                        </button>}
                      </div>
                    );}
                    return (
                      <div style={{display:"flex",alignItems:"center",gap:7,marginTop:m.text?5:0,background:"#ffffff0a",borderRadius:6,padding:"5px 9px"}}>
                        <span style={{fontSize:14}}>{fileIcon}</span>
                        <span style={{fontSize:11,color:"#d1d5db",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.fname||"файл"}</span>
                        <a href={cleanR2Url(m.furl||"")||"#"}
                          target="_blank" rel="noreferrer" download={m.fname||"file"}
                          style={{flexShrink:0,background:"#06b6d4",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:5,textDecoration:"none",display:"inline-block"}}>↓</a>
                      </div>
                    );
                  })()}
                </div>
                <div style={{fontSize:7,color:"#6b7280",marginTop:2,textAlign:isMe?"right":"left"}}>{(()=>{const t=Number(m.ts);return t>1000000000?new Date(t).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}):""})()}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* real upload progress bar */}
      {uploading && (
        <div style={{padding:"6px 10px",borderTop:"1px solid #1e1e2e",flexShrink:0,background:"#0d0d16"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <span style={{fontSize:10,color:"#9ca3af",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📎 {uploadName}</span>
            <span style={{fontSize:10,fontWeight:700,color:uploadPct===100?"#10b981":"#7c3aed",minWidth:36,textAlign:"right"}}>{uploadPct}%</span>
          </div>
          <div style={{height:4,background:"#2d2d44",borderRadius:3,overflow:"hidden"}}>
            <div style={{width:`${uploadPct}%`,height:"100%",background:uploadPct===100?"#10b981":"linear-gradient(90deg,#7c3aed,#a78bfa)",transition:"width 0.2s",borderRadius:3}}/>
          </div>
        </div>
      )}

      {/* error */}
      {err && <div style={{padding:"4px 10px",fontSize:10,color:"#ef4444",background:"#1a0000",borderTop:"1px solid #ef444430",flexShrink:0}}>{err} <button onClick={()=>setErr("")} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:11}}>✕</button></div>}

      {/* mention dropdown */}
      {showM && mentionList.length > 0 && (
        <div style={{position:"absolute",bottom:50,left:8,right:8,background:"#1a1a2e",border:"1px solid #3d3d5c",borderRadius:8,zIndex:200,overflow:"hidden"}}>
          {mentionList.map(m => (
            <div key={m.id} onClick={()=>pickMention(m)}
              style={{padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}
              onMouseEnter={e=>e.currentTarget.style.background="#2d2d44"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#374151",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff"}}>{(m.name||"?")[0]}</div>
              <span style={{color:"#a78bfa",fontSize:11}}>@{m.name}</span>
              <span style={{fontSize:9,color:"#6b7280",marginLeft:"auto"}}>{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* input */}
      <div style={{padding:"6px 8px",borderTop:"1px solid #1e1e2e",display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
        <input ref={fileRef} type="file" multiple accept="*/*" style={{position:"fixed",top:-9999,left:-9999,opacity:0,pointerEvents:"none"}} onChange={handleFiles}/>
        <button onClick={()=>{ if(!uploading&&!recording) fileRef.current?.click(); }} title="Прикрепить файл" disabled={uploading||recording}
          style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 9px",color:(uploading||recording)?"#4b5563":"#9ca3af",cursor:(uploading||recording)?"not-allowed":"pointer",fontSize:14,flexShrink:0}}>📎</button>
        <button onClick={recording?stopRec:startRec} disabled={uploading} title={recording?"Остановить":"Голосовое + транскрипция"}
          style={{background:recording?"#ef4444":"#1a1a2e",border:"1px solid "+(recording?"#ef4444":"#2d2d44"),borderRadius:7,padding:"5px 9px",color:recording?"#fff":"#9ca3af",cursor:uploading?"not-allowed":"pointer",fontSize:recording?10:14,fontWeight:700,flexShrink:0,minWidth:34,transition:"all 0.15s"}}>
          {recording?"⏹ "+recSec+"с":"🎙️"}</button>
        <input ref={inputRef} value={text} onChange={onType}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}if(e.key==="Escape")setShowM(false);}}
          placeholder="Сообщение... (@ для упоминания)"
          style={{...SI,flex:1,fontSize:11,padding:"5px 10px"}}/>
        <button onClick={send} disabled={!text.trim()}
          style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",border:"none",borderRadius:7,padding:"5px 12px",color:"#fff",cursor:text.trim()?"pointer":"default",fontSize:13,flexShrink:0,opacity:text.trim()?1:0.4}}>➤</button>
      </div>
    </div>
  );
}

export default MiniChat;
