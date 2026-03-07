import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Styles ────────────────────────────────────────────────────────────────────
const SI = { background:"#16161f", border:"1px solid #2d2d44", borderRadius:8, padding:"8px 12px", color:"#f0eee8", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
const BTN = (color="#06b6d4", outline=false) => ({
  background: outline ? "transparent" : color+"20",
  border: `1px solid ${color}50`,
  borderRadius:7, padding:"7px 14px", color, cursor:"pointer",
  fontSize:11, fontWeight:700, fontFamily:"inherit", transition:"all 0.1s",
});
const PLATFORM_COLORS = { instagram:"#e1306c", tiktok:"#00f2ea", youtube:"#ff0000", all:"#6b7280" };
const PLATFORM_ICONS  = { instagram:"📸", tiktok:"🎵", youtube:"▶️" };

function fmt(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
  if (n >= 1000) return (n/1000).toFixed(1)+"K";
  return String(n);
}
function fmtDur(s) {
  if (!s) return "";
  const m = Math.floor(s/60), sec = s%60;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

// ── SearchPanel ───────────────────────────────────────────────────────────────
function SearchPanel({ onResults, onLoading }) {
  const [platform, setPlatform] = useState("instagram");
  const [searchType, setSearchType] = useState("user");
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("/api/inspiration/searches")
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {});
  }, []);

  const searchTypes = {
    instagram: [{ id:"user", l:"По аккаунту @" }, { id:"hashtag", l:"По хештегу #" }],
    tiktok:    [{ id:"user", l:"По аккаунту @" }, { id:"keyword", l:"По ключевому слову" }],
    youtube:   [{ id:"channel", l:"По каналу @" }, { id:"keyword", l:"По ключевому слову" }],
  };

  const placeholder = {
    user: "username (без @)", hashtag: "хештег (без #)",
    keyword: "ключевое слово", channel: "название канала",
  };

  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const suggTimeout = useRef(null);

  async function fetchSuggestions(q) {
    if (!q || q.length < 2 || platform !== "instagram" || searchType !== "user") { setSuggestions([]); return; }
    try {
      const r = await fetch(`/api/inspiration/instagram/search-accounts?query=${encodeURIComponent(q)}`);
      const data = await r.json();
      setSuggestions(Array.isArray(data) ? data : []);
      setShowSugg(true);
    } catch(e) { setSuggestions([]); }
  }

  function onQueryChange(val) {
    setQuery(val);
    clearTimeout(suggTimeout.current);
    suggTimeout.current = setTimeout(() => fetchSuggestions(val), 400);
  }

  async function run() {
    if (!query.trim()) return;
    setShowSugg(false);
    setLoading(true); setError(""); onLoading(true);
    try {
      const r = await fetch(`/api/inspiration/parse/${platform}/${searchType}`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ [searchType==="hashtag"?"hashtag":searchType==="keyword"?"keyword":searchType==="channel"?"channel":"username"]: query.trim(), count }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Ошибка");
      onResults(data.items || [], `${platform} / ${query}`);
      // refresh history
      fetch("/api/inspiration/searches").then(r=>r.json()).then(setHistory).catch(()=>{});
    } catch(e) { setError(e.message); }
    setLoading(false); onLoading(false);
  }

  return (
    <div style={{background:"#111118",border:"1px solid #1e1e2e",borderRadius:12,padding:"16px"}}>
      <div style={{fontSize:10,color:"#6b7280",fontFamily:"monospace",fontWeight:700,marginBottom:10}}>ПОИСК / ПАРСИНГ</div>

      {/* Platform tabs */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {["instagram","tiktok","youtube"].map(p => (
          <button key={p} onClick={()=>{ setPlatform(p); setSearchType(Object.keys(searchTypes[p])[0]); setSearchType(searchTypes[p][0].id); }}
            style={{...BTN(PLATFORM_COLORS[p], platform!==p), flex:1, textAlign:"center"}}>
            {PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}
      </div>

      {/* Search type */}
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {searchTypes[platform].map(t => (
          <button key={t.id} onClick={()=>setSearchType(t.id)}
            style={{...BTN(PLATFORM_COLORS[platform], searchType!==t.id), flex:1}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Query input */}
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <div style={{position:"relative",flex:1}}>
          <input value={query} onChange={e=>onQueryChange(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&run()}
            onBlur={()=>setTimeout(()=>setShowSugg(false),200)}
            placeholder={placeholder[searchType]}
            style={{...SI,width:"100%"}}/>
          {showSugg && suggestions.length > 0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:8,zIndex:50,marginTop:2,overflow:"hidden"}}>
              {suggestions.map((u,i) => (
                <div key={i} onClick={()=>{ setQuery(u.username); setShowSugg(false); }}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",cursor:"pointer",borderBottom:"1px solid #0d0d16"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#2d2d44"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  {u.profile_pic && <img src={u.profile_pic} alt="" style={{width:24,height:24,borderRadius:"50%",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                  <div>
                    <div style={{fontSize:11,color:"#f0eee8",fontWeight:600}}>@{u.username}</div>
                    {u.full_name && <div style={{fontSize:9,color:"#6b7280"}}>{u.full_name}{u.followers>0?` · ${fmt(u.followers)} подп.`:""}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <select value={count} onChange={e=>setCount(Number(e.target.value))}
          style={{...SI,width:70}}>
          {[6,12,20,30].map(n=><option key={n} value={n}>{n} шт</option>)}
        </select>
      </div>

      <button onClick={run} disabled={loading||!query.trim()}
        style={{...BTN(PLATFORM_COLORS[platform]),width:"100%",padding:"9px",fontSize:12,opacity:loading||!query.trim()?0.5:1}}>
        {loading ? "⏳ Загружаю..." : `🔍 Найти на ${platform}`}
      </button>

      {error && <div style={{marginTop:8,fontSize:11,color:"#ef4444",background:"#ef444410",borderRadius:6,padding:"6px 10px"}}>{error}</div>}

      {/* History */}
      {history.length > 0 && (
        <div style={{marginTop:14}}>
          <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",marginBottom:6}}>ИСТОРИЯ ПОИСКА</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {history.slice(0,15).map(h => (
              <button key={h.id} onClick={()=>{ setPlatform(h.platform); setQuery(h.query.replace(/^[@#]/,"")); }}
                style={{background:"#1a1a2e",border:"1px solid #2d2d44",borderRadius:12,padding:"2px 9px",fontSize:10,color:PLATFORM_COLORS[h.platform]||"#9ca3af",cursor:"pointer"}}>
                {PLATFORM_ICONS[h.platform]} {h.query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VideoCard ─────────────────────────────────────────────────────────────────
function VideoCard({ item, projects, onStar, onNote, onProject, onDelete, onCreateTask }) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(item.note || "");
  const [projOpen, setProjOpen] = useState(false);
  const pc = PLATFORM_COLORS[item.platform] || "#6b7280";
  const proj = projects.find(p => p.id === item.project_id);

  function saveNote() {
    onNote(item.id, note);
    setShowNote(false);
  }

  return (
    <div style={{background:"#111118",border:`1px solid ${item.starred?"#f59e0b40":"#1e1e2e"}`,borderRadius:10,overflow:"hidden",display:"flex",flexDirection:"column",transition:"border 0.1s"}}>
      {/* Thumbnail */}
      <div style={{position:"relative",paddingTop:"56.25%",background:"#0d0d16",overflow:"hidden"}}>
        {item.thumbnail
          ? <img src={item.thumbnail} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
          : <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>{PLATFORM_ICONS[item.platform]}</div>}

        {/* Platform badge */}
        <div style={{position:"absolute",top:6,left:6,background:pc+"ee",borderRadius:5,padding:"2px 7px",fontSize:9,color:"#fff",fontWeight:700}}>
          {PLATFORM_ICONS[item.platform]} {item.platform}
        </div>

        {/* Duration */}
        {item.duration > 0 && (
          <div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.8)",borderRadius:4,padding:"1px 6px",fontSize:9,color:"#fff",fontFamily:"monospace"}}>
            {fmtDur(item.duration)}
          </div>
        )}

        {/* Star */}
        <button onClick={()=>onStar(item.id, !item.starred)}
          style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",border:"none",borderRadius:5,width:26,height:26,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{color:item.starred?"#f59e0b":"#9ca3af"}}>{item.starred?"★":"☆"}</span>
        </button>
      </div>

      {/* Body */}
      <div style={{padding:"10px 12px",flex:1,display:"flex",flexDirection:"column",gap:6}}>
        {/* Author */}
        <div style={{fontSize:10,color:pc,fontFamily:"monospace",fontWeight:700}}>
          @{item.author_username || item.author}
        </div>

        {/* Title */}
        <div style={{fontSize:11,fontWeight:600,color:"#f0eee8",lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {item.title || "Без названия"}
        </div>

        {/* Stats */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {item.views > 0 && <span style={{fontSize:9,color:"#6b7280",fontFamily:"monospace"}}>👁 {fmt(item.views)}</span>}
          {item.likes > 0 && <span style={{fontSize:9,color:"#6b7280",fontFamily:"monospace"}}>❤️ {fmt(item.likes)}</span>}
          {item.comments > 0 && <span style={{fontSize:9,color:"#6b7280",fontFamily:"monospace"}}>💬 {fmt(item.comments)}</span>}
          {item.shares > 0 && <span style={{fontSize:9,color:"#6b7280",fontFamily:"monospace"}}>↗ {fmt(item.shares)}</span>}
        </div>

        {/* Viral score */}
        {item.views > 0 && item.likes > 0 && (
          <div style={{fontSize:9,fontFamily:"monospace"}}>
            <span style={{color:"#6b7280"}}>Виральность: </span>
            <span style={{color: (item.likes/item.views) > 0.05 ? "#10b981" : (item.likes/item.views) > 0.02 ? "#f59e0b" : "#ef4444", fontWeight:700}}>
              {((item.likes/item.views)*100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Source */}
        <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace"}}>
          {item.source_query} · {item.published_at ? new Date(item.published_at).toLocaleDateString("ru") : ""}
        </div>

        {/* Project tag */}
        {proj && (
          <div style={{fontSize:9,color:proj.color,background:proj.color+"18",borderRadius:4,padding:"2px 7px",alignSelf:"flex-start",fontFamily:"monospace"}}>
            {proj.label}
          </div>
        )}

        {/* Note */}
        {item.note && !showNote && (
          <div style={{fontSize:10,color:"#9ca3af",background:"#1a1a2e",borderRadius:6,padding:"5px 8px",lineHeight:1.4}}>
            💬 {item.note}
          </div>
        )}
        {showNote && (
          <div>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Заметка к видео..." autoFocus
              style={{...SI,minHeight:60,resize:"vertical",fontSize:11,marginBottom:4}}/>
            <div style={{display:"flex",gap:5}}>
              <button onClick={saveNote} style={{...BTN("#10b981"),flex:1,padding:"5px"}}>Сохранить</button>
              <button onClick={()=>setShowNote(false)} style={{...BTN("#6b7280",true),padding:"5px 10px"}}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{padding:"8px 12px",borderTop:"1px solid #1e1e2e",display:"flex",gap:5,flexWrap:"wrap"}}>
        <a href={item.video_url} target="_blank" rel="noreferrer"
          style={{...BTN(pc),textDecoration:"none",padding:"5px 10px",fontSize:10}}>
          ↗ Открыть
        </a>
        <button onClick={()=>setShowNote(!showNote)} style={{...BTN("#8b5cf6",true),padding:"5px 10px",fontSize:10}}>
          💬 Заметка
        </button>
        <button onClick={()=>setProjOpen(!projOpen)} style={{...BTN("#06b6d4",true),padding:"5px 10px",fontSize:10}}>
          📁 Проект
        </button>
        <button onClick={()=>onCreateTask(item)} style={{...BTN("#10b981"),padding:"5px 10px",fontSize:10}}>
          + Задача
        </button>
        <button onClick={()=>onDelete(item.id)} style={{...BTN("#ef4444",true),padding:"5px 8px",fontSize:10}}>
          🗑
        </button>
      </div>

      {/* Project picker */}
      {projOpen && (
        <div style={{padding:"8px 12px",borderTop:"1px solid #1e1e2e",background:"#0d0d16"}}>
          <div style={{fontSize:9,color:"#6b7280",fontFamily:"monospace",marginBottom:6}}>ПРИКРЕПИТЬ К ПРОЕКТУ</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            <button onClick={()=>{ onProject(item.id, null); setProjOpen(false); }}
              style={{...BTN("#6b7280",true),padding:"3px 8px",fontSize:9}}>Нет</button>
            {projects.filter(p=>!p.archived).map(p => (
              <button key={p.id} onClick={()=>{ onProject(item.id, p.id); setProjOpen(false); }}
                style={{background:p.color+"20",border:`1px solid ${p.color}50`,borderRadius:5,padding:"3px 8px",fontSize:9,color:p.color,cursor:"pointer"}}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── StatsBar ──────────────────────────────────────────────────────────────────
function StatsBar({ items }) {
  const total = items.length;
  const starred = items.filter(x=>x.starred).length;
  const totalViews = items.reduce((s,x)=>s+(x.views||0),0);
  const totalLikes = items.reduce((s,x)=>s+(x.likes||0),0);
  const byPlatform = {};
  items.forEach(x => { byPlatform[x.platform] = (byPlatform[x.platform]||0)+1; });

  return (
    <div style={{display:"flex",gap:12,flexWrap:"wrap",background:"#111118",border:"1px solid #1e1e2e",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
      {[
        { l:"Всего видео", v:total, c:"#f0eee8" },
        { l:"В избранном", v:starred, c:"#f59e0b" },
        { l:"Суммарно просмотров", v:fmt(totalViews), c:"#06b6d4" },
        { l:"Суммарно лайков", v:fmt(totalLikes), c:"#ec4899" },
      ].map(s => (
        <div key={s.l} style={{textAlign:"center",minWidth:100}}>
          <div style={{fontSize:20,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div>
          <div style={{fontSize:8,color:"#4b5563",fontFamily:"monospace",marginTop:2}}>{s.l}</div>
        </div>
      ))}
      <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
        {Object.entries(byPlatform).map(([p,n]) => (
          <span key={p} style={{fontSize:10,color:PLATFORM_COLORS[p],background:PLATFORM_COLORS[p]+"18",borderRadius:8,padding:"3px 10px",fontFamily:"monospace",fontWeight:700}}>
            {PLATFORM_ICONS[p]} {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── CreateTaskModal ───────────────────────────────────────────────────────────
function CreateTaskModal({ item, projects, onClose, onCreated }) {
  const [project, setProject] = useState(item.project_id || (projects[0]?.id || ""));
  const [title, setTitle] = useState(item.title?.slice(0,80) || "");
  const [note, setNote] = useState(`Референс: ${item.video_url}\nАвтор: @${item.author_username}\n👁 ${fmt(item.views)}  ❤️ ${fmt(item.likes)}`);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const r = await fetch("/api/tasks", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          id: Math.random().toString(36).slice(2,9),
          type: "pre",
          title,
          project,
          status: "idea",
          data: { idea: note, reference_url: item.video_url, reference_platform: item.platform },
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      onCreated();
      onClose();
    } catch(e) { alert("Ошибка: "+e.message); }
    setLoading(false);
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:"#111118",border:"1px solid #2d2d44",borderRadius:14,width:"min(520px,96vw)",padding:20}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:13,fontWeight:800,color:"#10b981",marginBottom:14}}>✨ Создать задачу из референса</div>

        <div style={{marginBottom:10}}>
          <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:4}}>НАЗВАНИЕ ИДЕИ</div>
          <input value={title} onChange={e=>setTitle(e.target.value)} style={SI} placeholder="Название задачи"/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:4}}>ПРОЕКТ</div>
          <select value={project} onChange={e=>setProject(e.target.value)} style={SI}>
            {projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:9,color:"#9ca3af",fontFamily:"monospace",marginBottom:4}}>ОПИСАНИЕ / ИДЕЯ</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} style={{...SI,minHeight:80,resize:"vertical",fontSize:11,lineHeight:1.5}}/>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={create} disabled={loading||!title.trim()||!project}
            style={{...BTN("#10b981"),flex:1,padding:"9px",fontSize:12,opacity:loading||!title.trim()?0.5:1}}>
            {loading?"⏳ Создаю...":"✅ Создать задачу (Препродакшн)"}
          </button>
          <button onClick={onClose} style={{...BTN("#6b7280",true),padding:"9px 14px"}}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

// ── Main InspirationPage ──────────────────────────────────────────────────────
export default function InspirationPage({ projects, currentUser, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterProject, setFilterProject] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("new");
  const [newItems, setNewItems] = useState([]);
  const [createTaskItem, setCreateTaskItem] = useState(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const searchTimeout = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      if (filterStarred) params.set("starred", "true");
      if (filterProject) params.set("project_id", filterProject);
      if (search) params.set("search", search);
      const r = await fetch("/api/inspiration?" + params.toString());
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [filterPlatform, filterStarred, filterProject, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearchInput(val) {
    setSearch(val);
  }

  function handleResults(newI, label) {
    setNewItems(newI);
    load();
  }

  async function toggleStar(id, starred) {
    setItems(p => p.map(x => x.id===id ? {...x, starred} : x));
    await fetch(`/api/inspiration/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ starred }),
    });
  }

  async function saveNote(id, note) {
    setItems(p => p.map(x => x.id===id ? {...x, note} : x));
    await fetch(`/api/inspiration/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ note }),
    });
  }

  async function saveProject(id, project_id) {
    setItems(p => p.map(x => x.id===id ? {...x, project_id} : x));
    await fetch(`/api/inspiration/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ project_id }),
    });
  }

  async function deleteItem(id) {
    if (!window.confirm("Удалить?")) return;
    setItems(p => p.filter(x => x.id!==id));
    await fetch(`/api/inspiration/${id}`, { method:"DELETE" });
  }

  // Sort
  const sorted = [...items].sort((a,b) => {
    if (sortBy === "views")  return (b.views||0) - (a.views||0);
    if (sortBy === "likes")  return (b.likes||0) - (a.likes||0);
    if (sortBy === "viral")  return ((b.likes||0)/(b.views||1)) - ((a.likes||0)/(a.views||1));
    if (sortBy === "starred") return (b.starred?1:0) - (a.starred?1:0);
    return new Date(b.created_at||0) - new Date(a.created_at||0);
  });

  return (
    <div style={{position:"fixed",inset:0,background:"#0a0a10",zIndex:200,overflowY:"auto",fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:"#111118",borderBottom:"1px solid #1e1e2e",padding:"12px 20px",display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:10}}>
        <button onClick={onClose} style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:7,padding:"5px 10px",color:"#9ca3af",cursor:"pointer",fontSize:12}}>← Назад</button>
        <div style={{fontSize:16,fontWeight:800,color:"#f0eee8"}}>👁 Насмотренность</div>
        <div style={{fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>Референсы и идеи из соцсетей</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {loadingSearch && <span style={{fontSize:11,color:"#f59e0b"}}>⏳ Парсю...</span>}
          <span style={{fontSize:11,color:"#4b5563",fontFamily:"monospace"}}>{items.length} видео</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:0,minHeight:"calc(100vh - 53px)"}}>
        {/* Left: Search panel */}
        <div style={{borderRight:"1px solid #1e1e2e",padding:"16px",background:"#0d0d16"}}>
          <SearchPanel onResults={handleResults} onLoading={setLoadingSearch}/>
        </div>

        {/* Right: Results */}
        <div style={{padding:"16px"}}>
          {items.length > 0 && <StatsBar items={items}/>}

          {/* Filters */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            {/* Platform filter */}
            {["all","instagram","tiktok","youtube"].map(p => (
              <button key={p} onClick={()=>setFilterPlatform(p)}
                style={{...BTN(PLATFORM_COLORS[p]||"#6b7280", filterPlatform!==p),padding:"5px 12px",fontSize:10}}>
                {p==="all"?"🌐 Все":`${PLATFORM_ICONS[p]} ${p}`}
              </button>
            ))}

            <div style={{width:1,height:20,background:"#2d2d44",margin:"0 4px"}}/>

            {/* Star filter */}
            <button onClick={()=>setFilterStarred(!filterStarred)}
              style={{...BTN("#f59e0b",!filterStarred),padding:"5px 12px",fontSize:10}}>
              ★ Избранное
            </button>

            {/* Project filter */}
            <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}
              style={{...SI,width:140,padding:"5px 10px",fontSize:10}}>
              <option value="">Все проекты</option>
              {projects.filter(p=>!p.archived).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            {/* Sort */}
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
              style={{...SI,width:150,padding:"5px 10px",fontSize:10,marginLeft:"auto"}}>
              <option value="new">По дате добавления</option>
              <option value="views">По просмотрам</option>
              <option value="likes">По лайкам</option>
              <option value="viral">По виральности</option>
              <option value="starred">Сначала избранные</option>
            </select>

            {/* Search */}
            <input value={search} onChange={e=>handleSearchInput(e.target.value)}
              placeholder="🔎 Поиск по тексту..."
              style={{...SI,width:180,padding:"5px 10px",fontSize:10}}/>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{textAlign:"center",padding:"60px 0",color:"#4b5563"}}>
              <div style={{fontSize:32,marginBottom:8}}>⏳</div>
              <div style={{fontSize:12}}>Загружаю...</div>
            </div>
          ) : sorted.length === 0 ? (
            <div style={{textAlign:"center",padding:"80px 0",color:"#4b5563"}}>
              <div style={{fontSize:48,marginBottom:12}}>👁</div>
              <div style={{fontSize:14,fontWeight:700,color:"#6b7280",marginBottom:6}}>Здесь будут ваши референсы</div>
              <div style={{fontSize:11,color:"#374151",maxWidth:300,margin:"0 auto",lineHeight:1.6}}>
                Введите @аккаунт или #хештег слева и нажмите «Найти» — видео появятся здесь
              </div>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {sorted.map(item => (
                <VideoCard
                  key={item.id}
                  item={item}
                  projects={projects}
                  onStar={toggleStar}
                  onNote={saveNote}
                  onProject={saveProject}
                  onDelete={deleteItem}
                  onCreateTask={setCreateTaskItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {createTaskItem && (
        <CreateTaskModal
          item={createTaskItem}
          projects={projects}
          onClose={()=>setCreateTaskItem(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
