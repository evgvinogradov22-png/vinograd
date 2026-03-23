import { useState } from "react";
import { api } from "./api";

const SI = {
  background:"#16161f", border:"1px solid #2d2d44", borderRadius:8,
  padding:"10px 14px", color:"#f0eee8", fontSize:13, fontFamily:"inherit",
  outline:"none", width:"100%", boxSizing:"border-box",
};

const ROLES = ["Менеджер проекта","Сценарист","Оператор","Монтажёр","Продюсер","Таргетолог","Дизайнер"];
const COLORS = ["#ef4444","#3b82f6","#ec4899","#10b981","#f59e0b","#8b5cf6","#06b6d4","#f97316"];

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ telegram:"", password:"", name:"", role:"Продюсер", color:"#8b5cf6", invite_password:"" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const u = (k,v) => setForm(p => ({...p,[k]:v}));

  async function submit() {
    setErr(""); setOk(""); setLoading(true);
    try {
      if (mode === "reset") {
        const r=await fetch("/api/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telegram:form.telegram,new_password:form.password,invite_password:form.invite_password})});
        const d=await r.json();
        if(!r.ok) throw new Error(d.error);
        setOk("Пароль обновлён — войдите с новым паролем");
        setMode("login");
      } else {
        const user = mode === "login"
          ? await api.login({ telegram: form.telegram, password: form.password })
          : await api.register(form);
        // Save token separately for API requests
        if (user.token) localStorage.setItem("vg_token", user.token);
        localStorage.setItem("vg_user", JSON.stringify(user));
        onLogin(user);
      }
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0f"}}>
      <div style={{width:360,background:"#111118",border:"1px solid #2d2d44",borderRadius:16,padding:32}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:8}}>🍇</div>
          <div style={{fontSize:22,fontWeight:800}}>Виноград</div>
          <div style={{fontSize:11,color:"#4b5563",fontFamily:"monospace",marginTop:4}}>production system</div>
        </div>

        <div style={{display:"flex",marginBottom:20,background:"#0d0d16",border:"1px solid #1e1e2e",borderRadius:8,padding:3}}>
          {[["login","Войти"],["register","Регистрация"],["reset","Забыл пароль"]].map(([m,l]) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); setOk(""); }} style={{flex:1,padding:"7px",borderRadius:6,cursor:"pointer",background:mode===m?"#8b5cf6":"transparent",border:"none",color:mode===m?"#fff":"#6b7280",fontFamily:"inherit",fontSize:11,fontWeight:mode===m?700:400}}>{l}</button>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {mode === "register" && (
            <input value={form.name} onChange={e=>u("name",e.target.value)} placeholder="Имя Фамилия" style={SI}/>
          )}
          <input value={form.telegram} onChange={e=>u("telegram",e.target.value)} placeholder="@telegram" style={SI}/>
          <input type="password" value={form.password} onChange={e=>u("password",e.target.value)} placeholder="Пароль" style={SI}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>

          {mode === "register" && <>
            <select value={form.role} onChange={e=>u("role",e.target.value)} style={SI}>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <div>
              <div style={{fontSize:9,color:"#4b5563",fontFamily:"monospace",marginBottom:6}}>ЦВЕТ АВАТАРА</div>
              <div style={{display:"flex",gap:6}}>
                {COLORS.map(c=><div key={c} onClick={()=>u("color",c)} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",border:form.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
              </div>
            </div>
            <input value={form.invite_password} onChange={e=>u("invite_password",e.target.value)} placeholder="Код приглашения" style={SI}/>
          </>}

                    {mode==="reset"&&<input value={form.invite_password} onChange={e=>u("invite_password",e.target.value)} placeholder="Код приглашения" style={SI}/> }
          {ok&&<div style={{fontSize:11,color:"#10b981",background:"#001a0a",border:"1px solid #10b98130",borderRadius:7,padding:"8px 12px"}}>{ok}</div>}
          {err && <div style={{fontSize:11,color:"#ef4444",background:"#1a0000",border:"1px solid #ef444430",borderRadius:7,padding:"8px 12px"}}>{err}</div>}

          <button onClick={submit} disabled={loading} style={{background:"linear-gradient(135deg,#8b5cf6,#ec4899)",border:"none",borderRadius:8,padding:"11px",color:"#fff",cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",fontSize:14,fontWeight:700,marginTop:4}}>
            {loading ? "⏳ Загрузка..." : mode==="login" ? "Войти" : mode==="reset" ? "Сменить пароль" : "Зарегистрироваться"}
          </button>
        </div>
      </div>
    </div>
  );
}
