const BASE = "";

async function req(method, url, body) {
  const userId = (() => { try { return JSON.parse(localStorage.getItem("vg_user")||"{}").id||""; } catch(e){ return ""; } })();
  const opts = { method, headers: { "Content-Type": "application/json", ...(userId ? {"x-user-id": userId} : {}) } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + url, opts);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
  return r.json();
}

export const api = {
  // auth
  register: (d) => req("POST", "/api/auth/register", d),
  login:    (d) => req("POST", "/api/auth/login", d),

  // users
  getUsers:    ()     => req("GET",    "/api/users"),
  updateUser:  (id,d) => req("PATCH",  `/api/users/${id}`, d),
  deleteUser:  (id)   => req("DELETE", `/api/users/${id}`),

  // projects
  getProjects:    ()     => req("GET",    "/api/projects"),
  createProject:  (d)    => req("POST",   "/api/projects", d),
  updateProject:  (id,d) => req("PATCH",  `/api/projects/${id}`, d),
  deleteProject:  (id)   => req("DELETE", `/api/projects/${id}`),

  // tasks
  getTasks:   (params={}) => req("GET",    "/api/tasks?" + new URLSearchParams(params).toString()),
  createTask: (d)         => req("POST",   "/api/tasks", d),
  updateTask: (id,d)      => req("PATCH",  `/api/tasks/${id}`, d),
  deleteTask: (id)        => req("DELETE", `/api/tasks/${id}`),

  // chat
  getChat:    (taskId)    => req("GET",  `/api/chat/${taskId}`),
  sendMsg:    (taskId, d) => req("POST", `/api/chat/${taskId}`, d),

  // upload
  uploadFile: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (!r.ok) throw new Error("Upload failed");
    return r.json();
  },
};

// WebSocket
export function createWS(taskId, onMessage) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    const userId = JSON.parse(localStorage.getItem("vg_user") || "{}").id || "anon";
    ws.send(JSON.stringify({ type: "join", taskId, userId }));
  };
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  return ws;
}
