import React, { useState, useRef, useEffect } from "react";
import { SI, LB, PRE_STATUSES, PROD_STATUSES, POST_STATUSES, PUB_STATUSES, ADMIN_STATUSES } from "../../constants";
import { xhrUpload, cleanR2Url, isR2Url, fileHref } from "../../utils/files";
import { genId } from "../../utils/helpers";
import { useTaskForm } from "../../utils/useTaskForm";
import { Field, Btn, TeamSelect, StatusRow, SaveRow, UploadProgress, TzField } from "../ui";

function SingleReelStats({ taskId, reelUrl, index, onUrlSave, reelsCount }) {
  const [url, setUrl] = useState(reelUrl || "");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(!reelUrl);
  const storageKey = index === 0 ? "reel_url" : `reel_url_${index}`;

  useEffect(() => {
    if (taskId && reelUrl) loadHistory();
  }, [taskId, reelUrl]);

  async function loadHistory() {
    setLoading(true);
    try {
      const r = await fetch(`/api/reel-stats/${taskId}`);
      const data = await r.json();
      setHistory(Array.isArray(data) ? data.filter(h => h.reel_url === reelUrl) : []);
    } catch(e) {}
    setLoading(false);
  }

  const [errMsg, setErrMsg] = useState("");

  async function refresh() {
    setRefreshing(true);
    setErrMsg("");
    try {
      const r = await fetch(`/api/reel-stats/refresh/${taskId}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ url_key: storageKey })
      });
      const data = await r.json();
      if (!r.ok) {
        // Если URL не задан — просто показываем подсказку добавить URL, не ошибку
        if (data.error?.includes("reel_url not set")) {
          setEditing(true);
        } else {
          setErrMsg(data.error || "Ошибка обновления");
        }
        setRefreshing(false);
        return;
      }
      await loadHistory();
    } catch(e) { setErrMsg(e.message); }
    setRefreshing(false);
  }

  async function saveUrl() {
    if (!url.trim()) return;
    onUrlSave(url.trim());
    setEditing(false);
    if (taskId) {
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ data: { [storageKey]: url.trim() } }),
        });
      } catch(e) { console.error("reel_url save:", e); }
    }
  }

  const latest = history[history.length - 1];
  const prev   = history[history.length - 2];

  function delta(key) {
    if (!latest || !prev) return null;
    const d = (latest[key]||0) - (prev[key]||0);
    return d > 0 ? `+${d}` : d < 0 ? String(d) : null;
  }
  function fmt(n) {
    if (!n) return "0";
    if (n >= 1000000) return (n/1000000).toFixed(1)+"M";
    if (n >= 1000) return (n/1000).toFixed(1)+"K";
    return String(n);
  }
  function Sparkline({ data, color }) {
    if (data.length < 2) return null;
    const w = 100, h = 28;
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    }).join(" ");
    const last = pts.split(" ").pop().split(",");
    return (
      <svg width={w} height={h} style={{overflow:"visible"}}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx={last[0]} cy={last[1]} r="3" fill={color}/>
      </svg>
    );
  }

  const viewHistory = history.map(h => h.views || 0);
  const likeHistory = history.map(h => h.likes || 0);
  const label = reelsCount > 1 ? `📊 РИЛС ${index + 1} из ${reelsCount}` : "📊 СТАТИСТИКА РИЛСА";

  return (
    <div style={{background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:10,padding:"12px 14px",marginBottom: reelsCount > 1 ? 8 : 0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontSize:9,color:"#ec4899",fontFamily:"monospace",fontWeight:700}}>{label}</div>
        <div style={{display:"flex",gap:6}}>
          {reelUrl && !editing && (
            <button onClick={refresh} disabled={refreshing}
              style={{background:"transparent",border:"1px solid #ec489940",borderRadius:6,padding:"3px 10px",color:"#ec4899",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
              {refreshing ? "⏳" : "🔄 Обновить"}
            </button>
          )}
          <button onClick={() => setEditing(!editing)}
            style={{background:"transparent",border:"1px solid #2d2d44",borderRadius:6,padding:"3px 10px",color:"#9ca3af",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>
            {editing ? "✕" : "✏️ URL"}
          </button>
        </div>
      </div>

      {(editing || !reelUrl) && (
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key==="Enter" && saveUrl()}
            placeholder="https://www.instagram.com/reel/..."
            style={{background:"#16161f",border:"1px solid #2d2d44",borderRadius:7,padding:"6px 10px",color:"#f0eee8",fontSize:11,outline:"none",flex:1,fontFamily:"inherit"}}/>
          <button onClick={saveUrl} disabled={!url.trim()}
            style={{background:"#ec489920",border:"1px solid #ec489950",borderRadius:7,padding:"6px 14px",color:"#ec4899",cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:700}}>
            Сохранить
          </button>
        </div>
      )}

      {!reelUrl && !editing && (
        <div style={{textAlign:"center",padding:"10px 0",color:"#4b5563",fontSize:11}}>
          Вставьте ссылку на рилс
        </div>
      )}

      {reelUrl && !editing && (
        <>
          {latest ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
              {[
                { key:"views",    icon:"👁",  label:"Просмотры", color:"#06b6d4" },
                { key:"likes",    icon:"❤️", label:"Лайки",     color:"#ec4899" },
                { key:"comments", icon:"💬",  label:"Коммент.",  color:"#8b5cf6" },
              ].map(s => {
                const d = delta(s.key);
                return (
                  <div key={s.key} style={{background:"#111118",border:"1px solid #1a1a2e",borderRadius:7,padding:"6px 8px",textAlign:"center"}}>
                    <div style={{fontSize:13,marginBottom:1}}>{s.icon}</div>
                    <div style={{fontSize:14,fontWeight:800,color:s.color,fontFamily:"monospace"}}>{fmt(latest[s.key]||0)}</div>
                    <div style={{fontSize:7,color:"#4b5563",fontFamily:"monospace"}}>{s.label}</div>
                    {d && <div style={{fontSize:8,color:d.startsWith("+")?"#10b981":"#ef4444",fontFamily:"monospace",marginTop:1}}>{d}</div>}
                  </div>
                );
              })}
            </div>
          ) : loading ? (
            <div style={{textAlign:"center",padding:"10px",color:"#4b5563",fontSize:11}}>⏳ Загружаю...</div>
          ) : (
            <div style={{textAlign:"center",padding:"10px",color:"#4b5563",fontSize:11}}>Нет данных — нажмите «🔄 Обновить»</div>
          )}
          {errMsg && <div style={{fontSize:10,color:"#ef4444",fontFamily:"monospace",marginTop:4,textAlign:"center"}}>⚠️ {errMsg}</div>}
          {history.length >= 2 && (
            <div style={{display:"flex",gap:12,padding:"6px 0",borderTop:"1px solid #1a1a2e"}}>
              <div><div style={{fontSize:7,color:"#4b5563",fontFamily:"monospace",marginBottom:2}}>👁 ПРОСМОТРЫ</div><Sparkline data={viewHistory} color="#06b6d4"/></div>
              <div><div style={{fontSize:7,color:"#4b5563",fontFamily:"monospace",marginBottom:2}}>❤️ ЛАЙКИ</div><Sparkline data={likeHistory} color="#ec4899"/></div>
            </div>
          )}
          {latest && (
            <div style={{fontSize:7,color:"#374151",fontFamily:"monospace",textAlign:"right",marginTop:4}}>
              {new Date(latest.recorded_at).toLocaleString("ru",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
              {history.length > 1 && ` · ${history.length} снапшотов`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReelStatsBlock({ taskId, reelUrls, onUrlSave, reelsCount }) {
  const count = Math.max(1, reelsCount || 1);
  const urls = Array.isArray(reelUrls) ? reelUrls : (reelUrls ? [reelUrls] : []);
  return (
    <div>
      {Array.from({length: count}, (_, i) => (
        <SingleReelStats
          key={i}
          taskId={taskId}
          reelUrl={urls[i] || ""}
          index={i}
          reelsCount={count}
          onUrlSave={url => {
            const newUrls = [...urls];
            newUrls[i] = url;
            onUrlSave(newUrls);
          }}
        />
      ))}
    </div>
  );
}

export { SingleReelStats, ReelStatsBlock };
