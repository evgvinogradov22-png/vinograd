const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");
const multer = require("multer");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { Readable } = require("stream");
const execFileAsync = promisify(execFile);
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const INVITE_PASSWORD = process.env.INVITE_PASSWORD || "vinograd2026";

// ── PostgreSQL ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});
const q  = async (sql, p=[]) => (await pool.query(sql, p)).rows;
const q1 = async (sql, p=[]) => (await pool.query(sql, p)).rows[0] || null;

// ── Cloudflare R2 ─────────────────────────────────────────────────────────────
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
const R2_BUCKET = process.env.R2_BUCKET || "contentflow-files";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

// ── Multer (memory) ───────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Update last_active on every authenticated request ─────────────────────────
app.use((req, res, next) => {
  const uid = req.headers["x-user-id"];
  if (uid) q("UPDATE users SET last_active=$1 WHERE id=$2", [Date.now(), uid]).catch(() => {});
  next();
});

const BUILD_PATH = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(BUILD_PATH)) app.use(express.static(BUILD_PATH));

// plain text passwords

// ── Init DB ───────────────────────────────────────────────────────────────────
async function initDb() {
  // Each statement must be a separate query call for pg
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Оператор',
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      password_hash TEXT NOT NULL,
      telegram_chat_id TEXT DEFAULT '',
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT ''`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      description TEXT DEFAULT '',
      links JSONB DEFAULT '[]',
      archived BOOLEAN DEFAULT FALSE,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      data JSONB DEFAULT '{}',
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
      updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT DEFAULT '',
      file_url TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    )
  `);

  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pmp_project_id TEXT DEFAULT ''`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_type    ON tasks(type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_task     ON chat_messages(task_id)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    task_id TEXT DEFAULT '',
    task_type TEXT DEFAULT '',
    title TEXT DEFAULT '',
    body TEXT DEFAULT '',
    created_at BIGINT DEFAULT 0,
    read BOOLEAN DEFAULT FALSE
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS analytics_kpi (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    kpi INT DEFAULT 0,
    UNIQUE(project_id, month, year)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS training (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'Другое',
    created_at BIGINT DEFAULT 0
  )`);

  // Set director role from env
  const dirTg = process.env.DIRECTOR_TELEGRAM || "";
  if (dirTg) {
    const clean = dirTg.replace(/^@/,"").toLowerCase().trim();
    await q("UPDATE users SET role='Директор' WHERE LOWER(REPLACE(telegram,'@',''))=$1", [clean]).catch(()=>{});
    console.log("[DIRECTOR] role set for:", clean);
  }
  console.log("✅ Database ready");
}

// ── WebSocket broadcast ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const clients = new Map(); // ws → { userId, taskId }

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "join") {
        clients.set(ws, { userId: msg.userId, taskId: msg.taskId });
      }
      if (msg.type === "join_user") {
        clients.set(ws, { userId: msg.userId, taskId: null });
      }
    } catch {}
  });
  ws.on("close", () => clients.delete(ws));
});

function broadcast(taskId, payload) {
  const data = JSON.stringify(payload);
  for (const [ws, info] of clients) {
    if (info.taskId === taskId && ws.readyState === 1) ws.send(data);
  }
}

// Send notification to specific user (all their connections)
function notifyWS(userId, payload) {
  const data = JSON.stringify({ type: "notification", ...payload });
  for (const [ws, info] of clients) {
    if (info.userId === userId && ws.readyState === 1) ws.send(data);
  }
}

// Save notification to DB + send via WS
async function pushNotif(userId, kind, taskId, taskType, title, body) {
  if (!userId) return;
  const id = "n_" + uuidv4().replace(/-/g,"").slice(0,10);
  try {
    await q("INSERT INTO notifications(id,user_id,kind,task_id,task_type,title,body,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, userId, kind, taskId||"", taskType||"", title||"", body||"", Date.now()]);
    console.log("[NOTIF] saved:", kind, "for", userId, "task:", taskId);
  } catch(e) {
    console.error("[NOTIF ERROR]", e.message);
  }
  notifyWS(userId, { kind, taskId, taskType, title, text: body });
}

// ════════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════════

app.post("/api/auth/register", async (req, res) => {
  try {
    const { telegram, name, role, color, password, invite_password } = req.body;
    if (!telegram || !password) return res.status(400).json({ error: "Заполните все поля" });
    if (invite_password !== INVITE_PASSWORD) return res.status(403).json({ error: "Неверный код приглашения" });
    const clean = telegram.replace(/^@/, "").toLowerCase().trim();
    if (await q1("SELECT id FROM users WHERE telegram=$1", [clean]))
      return res.status(409).json({ error: "Этот ник уже зарегистрирован" });
    const id = "u_" + uuidv4().replace(/-/g, "").slice(0, 10);
    await q("INSERT INTO users(id,telegram,name,role,color,password_hash) VALUES($1,$2,$3,$4,$5,$6)",
      [id, clean, name || clean, role || "Оператор", color || "#8b5cf6", password]);
    res.json({ id, telegram: clean, name: name || clean, role: role || "Оператор", color: color || "#8b5cf6" });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка сервера" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { telegram, password } = req.body;
    const clean = telegram.replace(/^@/, "").toLowerCase().trim();
        const user = await q1("SELECT * FROM users WHERE telegram=$1 OR telegram=$2", [clean, "@"+clean]);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    if (password !== user.password_hash) return res.status(401).json({ error: "Неверный пароль" });
    await q("UPDATE users SET last_active=$1 WHERE id=$2", [Date.now(), user.id]);
    res.json({ id: user.id, telegram: user.telegram, name: user.name, role: user.role, color: user.color });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка сервера" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/notifications — получить непрочитанные для текущего пользователя
app.get("/api/notifications", async (req, res) => {
  const uid = req.headers["x-user-id"];
  if (!uid) return res.json([]);
  try {
    const rows = await q("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [uid]);
    console.log("[NOTIF GET] user:", uid, "count:", rows.length);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// POST /api/notifications/read — отметить прочитанным
app.post("/api/notifications/read", async (req, res) => {
  const uid = req.headers["x-user-id"];
  const { id } = req.body;
  if (!uid) return res.json({});
  try {
    if (id) await q("DELETE FROM notifications WHERE id=$1 AND user_id=$2", [id, uid]);
    else await q("DELETE FROM notifications WHERE user_id=$1", [uid]);
    res.json({ ok: true });
  } catch(e) { res.json({ ok: false }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// ANALYTICS KPI
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/analytics/kpi", async (req, res) => {
  try {
    const rows = await q("SELECT * FROM analytics_kpi");
    res.json(rows);
  } catch(e) { res.json([]); }
});

app.post("/api/analytics/kpi", async (req, res) => {
  const { project_id, month, year, kpi } = req.body;
  if (!project_id) return res.status(400).json({ error: "no project_id" });
  try {
    await q(`INSERT INTO analytics_kpi(id,project_id,month,year,kpi) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(project_id,month,year) DO UPDATE SET kpi=$5`,
      ["kpi_"+project_id+"_"+year+"_"+month, project_id, month, year, kpi||0]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// TRAINING
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/training", async (req, res) => {
  try { res.json(await q("SELECT * FROM training ORDER BY created_at DESC")); }
  catch(e) { res.json([]); }
});

app.post("/api/training", async (req, res) => {
  const { title, url, description, category } = req.body;
  if (!title) return res.status(400).json({ error: "Нет названия" });
  const id = "tr_" + uuidv4().replace(/-/g,"").slice(0,10);
  const now = Date.now();
  try {
    await q("INSERT INTO training(id,title,url,description,category,created_at) VALUES($1,$2,$3,$4,$5,$6)",
      [id, title, url||"", description||"", category||"Другое", now]);
    res.json({ id, title, url, description, category, created_at: now });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/training/:id", async (req, res) => {
  try {
    await q("DELETE FROM training WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// USERS (team)
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/users", async (req, res) => {
  try { res.json(await q("SELECT id,telegram,name,role,color,last_active,avatar_url FROM users ORDER BY created_at")); }
  catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.patch("/api/users/:id", async (req, res) => {
  try {
    const { name, role, color, telegram } = req.body;
    await q("UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), color=COALESCE($3,color), telegram=COALESCE($4,telegram) WHERE id=$5",
      [name, role, color, telegram, req.params.id]);
    res.json(await q1("SELECT id,telegram,name,role,color FROM users WHERE id=$1", [req.params.id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.delete("/api/users/:id", async (req, res) => {
  try { await q("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/projects", async (req, res) => {
  try { res.json(await q("SELECT * FROM projects ORDER BY created_at")); }
  catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.post("/api/projects", async (req, res) => {
  try {
    const { label, color, description, links } = req.body;
    if (!label) return res.status(400).json({ error: "Нужно название" });
    const id = "proj_" + uuidv4().replace(/-/g, "").slice(0, 10);
    await q("INSERT INTO projects(id,label,color,description,links) VALUES($1,$2,$3,$4,$5)",
      [id, label, color || "#8b5cf6", description || "", JSON.stringify(links || [])]);
    res.json(await q1("SELECT * FROM projects WHERE id=$1", [id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.patch("/api/projects/:id", async (req, res) => {
  try {
    const { label, color, description, links, archived, pmp_project_id } = req.body;
    await q(`UPDATE projects SET
      label          = COALESCE($1, label),
      color          = COALESCE($2, color),
      description    = COALESCE($3, description),
      links          = COALESCE($4, links),
      archived       = COALESCE($5, archived),
      pmp_project_id = COALESCE($6, pmp_project_id)
      WHERE id = $7`,
      [label, color, description, links ? JSON.stringify(links) : null, archived, pmp_project_id ?? null, req.params.id]);
    res.json(await q1("SELECT * FROM projects WHERE id=$1", [req.params.id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.delete("/api/projects/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chat_messages WHERE task_id IN (SELECT id FROM tasks WHERE project_id=$1)", [req.params.id]);
    await client.query("DELETE FROM tasks WHERE project_id=$1", [req.params.id]);
    await client.query("DELETE FROM projects WHERE id=$1", [req.params.id]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch(e) {
    await client.query("ROLLBACK").catch(()=>{});
    res.status(500).json({ error: "Ошибка" });
  } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════════════════════════
// TASKS  (type = pre | prod | post_reels | post_video | post_carousel | pub)
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/tasks", async (req, res) => {
  try {
    const { type, project_id } = req.query;
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params = [];
    if (type)       { params.push(type);       sql += ` AND type=$${params.length}`; }
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}`; }
    sql += " ORDER BY created_at";
    res.json(await q(sql, params));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { type, title, project_id, status, data } = req.body;
    if (!type) return res.status(400).json({ error: "type обязателен" });
    const effectiveProjectId = project_id || "none";
    const id = "t_" + uuidv4().replace(/-/g, "").slice(0, 10);
    const now = Date.now();
    await q("INSERT INTO tasks(id,type,title,project_id,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, type, title || "", effectiveProjectId, status || "idea", JSON.stringify(data || {}), now, now]);
    const saved = await q1("SELECT * FROM tasks WHERE id=$1", [id]);
    // Notify assignees about new task
    if (saved) {
      const taskData = data || {};
      const assignees = ["producer","editor","scriptwriter","operator","designer","customer","executor"]
        .map(f => taskData[f]).filter(Boolean);
      for (const uid of [...new Set(assignees)]) {
        await notifyUser(uid, `📋 Новая задача назначена на вас:\n<b>${title||"Без названия"}</b>`);
        pushNotif(uid, "task_assigned", saved.id, type, title||"Без названия", "Новая задача назначена на вас");
      }
    }
    res.json(saved);
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка" }); }
});

app.patch("/api/tasks/:id", async (req, res) => {
  try {
    const { title, project_id, status, data, archived, completed_at } = req.body;
    const now = Date.now();
    const reqUser = req.headers["x-user-id"] || "";

    // Fetch old task before update for change log
    const oldTask = await q1("SELECT * FROM tasks WHERE id=$1", [req.params.id]);

    // Build dynamic update to avoid overwriting fields not passed
    const sets = ["updated_at=$1"];
    const vals = [now];
    let i = 2;
    if (title      !== undefined) { sets.push(`title=$${i++}`);      vals.push(title); }
    if (project_id !== undefined) { sets.push(`project_id=$${i++}`); vals.push(project_id); }
    if (status     !== undefined) { sets.push(`status=$${i++}`);     vals.push(status); }
    if (data       !== undefined) { sets.push(`data=tasks.data || '{}'::jsonb || $${i++}::jsonb`); vals.push(JSON.stringify(data)); }
    if (archived      !== undefined) { sets.push(`archived=$${i++}`);      vals.push(archived); }
    if (completed_at  !== undefined) { sets.push(`completed_at=$${i++}`); vals.push(completed_at); }
    vals.push(req.params.id);
    await q(`UPDATE tasks SET ${sets.join(",")} WHERE id=$${i}`, vals);
    const updated = await q1("SELECT * FROM tasks WHERE id=$1", [req.params.id]);
    res.json(updated);

    // ── Change log in chat ─────────────────────────────────────────────────
    try {
      if (reqUser && oldTask) {
        const actor = await q1("SELECT name FROM users WHERE id=$1", [reqUser]);
        const actorName = actor?.name || "Кто-то";
        const changes = [];

        // Status change
        if (status !== undefined && status !== oldTask.status) {
          const STATUS_LABELS = {
            idea:"Идея", brief:"Бриф", script:"Сценарий", approved:"Утверждено",
            planned:"Запланировано", shooting:"Съёмка", editing:"Монтаж", done:"Готово",
            not_started:"Не начат", in_progress:"В монтаже", review:"На проверке",
            corrections:"Правки", published:"Опубликовано", draft:"Черновик",
            ready:"Готово к публикации", scheduled:"Запланировано",
            new:"Новая", waiting:"Ожидание", cancelled:"Отменено"
          };
          const from = STATUS_LABELS[oldTask.status] || oldTask.status;
          const to = STATUS_LABELS[status] || status;
          changes.push(`статус: «${from}» → «${to}»`);
        }

        // Title change
        if (title !== undefined && title !== oldTask.title) {
          changes.push(`название: «${oldTask.title}» → «${title}»`);
        }

        // Archived change
        if (archived !== undefined && archived !== oldTask.archived) {
          changes.push(archived ? "задача архивирована" : "задача восстановлена из архива");
        }

        // Data field changes
        if (data !== undefined && oldTask.data) {
          const oldD = oldTask.data || {};
          const newD = data || {};
          const FIELD_LABELS = {
            deadline:"дедлайн", shoot_date:"дата съёмки", planned_date:"дата публикации",
            producer:"заказчик", executor:"исполнитель", editor:"монтажёр",
            scriptwriter:"сценарист", operator:"оператор", designer:"дизайнер",
            customer:"заказчик", post_deadline:"дедлайн поста"
          };
          for (const [field, label] of Object.entries(FIELD_LABELS)) {
            if (newD[field] !== undefined && newD[field] !== oldD[field]) {
              if (newD[field]) {
                changes.push(`${label} изменён`);
              }
            }
          }
        }

        if (changes.length > 0) {
          const logText = `✏️ ${actorName} изменил: ${changes.join(", ")}`;
          const logId = "log_" + require("crypto").randomBytes(5).toString("hex");
          await q(
            "INSERT INTO chat_messages(id,task_id,user_id,text,file_url,file_name,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
            [logId, req.params.id, reqUser, logText, "", "__log__", now]
          );
          broadcast(req.params.id, { type: "message", msg: { id: logId, task_id: req.params.id, user_id: reqUser, text: logText, file_url: "", file_name: "__log__", created_at: now }});
        }
      }
    } catch(le) { console.warn("Change log error:", le.message); }

    // Smart notifications
    try {
      const taskData = updated?.data || {};
      const custId = taskData.producer || taskData.customer || "";
      const execId = taskData.editor || taskData.scriptwriter || taskData.operator || taskData.designer || taskData.executor || "";
      if (reqUser && custId && execId) {
        if (reqUser === custId) {
          const txt = await taskNotifyText(req.params.id, "✏️ Заказчик внёс изменения в задачу", reqUser);
          await notifyUser(execId, txt);
        } else if (reqUser === execId) {
          const txt = await taskNotifyText(req.params.id, "🔧 Исполнитель обновил задачу", reqUser);
          await notifyUser(custId, txt);
        }
      }
      if (status !== undefined && execId && execId !== reqUser) {
        const txt = await taskNotifyText(req.params.id, "📋 Тебя назначили исполнителем задачи", reqUser);
        await notifyUser(execId, txt);
      }
    } catch(ne) { console.warn("Notification error:", ne.message); }
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка" }); }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    await q("DELETE FROM chat_messages WHERE task_id=$1", [req.params.id]);
    await q("DELETE FROM tasks WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/chat/:taskId", async (req, res) => {
  try {
    res.json(await q("SELECT * FROM chat_messages WHERE task_id=$1 ORDER BY created_at LIMIT 200", [req.params.taskId]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.post("/api/chat/:taskId", async (req, res) => {
  try {
    const { user_id, text, file_url, file_name } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id обязателен" });
    const id = "msg_" + uuidv4().replace(/-/g, "").slice(0, 10);
    const now = Date.now();
    await q("INSERT INTO chat_messages(id,task_id,user_id,text,file_url,file_name,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [id, req.params.taskId, user_id, text || "", file_url || "", file_name || "", now]);
    const msg = { id, task_id: req.params.taskId, user_id, text, file_url, file_name, created_at: now };

    // ── Chat notifications (7, 8) ─────────────────────────────────────────────
    try {
      const taskId = req.params.taskId;
      const task = await q1("SELECT * FROM tasks WHERE id=$1", [taskId]);
      if (task) {
        const taskData = task.data || {};
        const participants = new Set([
          taskData.producer, taskData.customer, taskData.editor,
          taskData.scriptwriter, taskData.operator, taskData.designer, taskData.executor
        ].filter(Boolean));
        const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : (process.env.APP_URL || "");
        const link = appUrl ? ` <a href="${appUrl}">→ Открыть</a>` : "";
        const sender = await q1("SELECT name FROM users WHERE id=$1", [user_id]);
        const senderName = sender?.name || "Кто-то";
        const preview = text ? (text.length > 80 ? text.slice(0, 80) + "…" : text) : "📎 файл";

        // Notify @mentioned users (7)
        if (text) {
          const mentions = [...text.matchAll(/@([\wа-яёА-ЯЁ]+)/gi)].map(m => m[1].toLowerCase());
          for (const mention of mentions) {
            const mentioned = await q1("SELECT id FROM users WHERE LOWER(name)=LOWER($1)", [mention]);
            if (mentioned && mentioned.id !== user_id) {
              const txt = `🔔 <b>@${senderName}</b> упомянул тебя в «${task.title||"задаче"}»:

"${preview}"${link}`;
              await notifyUser(mentioned.id, txt);
              pushNotif(mentioned.id, "chat_message", taskId, task.type||"pre", task.title||"", preview);
              participants.delete(mentioned.id); // don't double-notify
            }
          }
        }

        // Notify all other participants (8)
        for (const pid of participants) {
          if (pid !== user_id) {
            const txt = `💬 <b>${senderName}</b> написал в «${task.title||"задаче"}»:

${preview}${link}`;
            await notifyUser(pid, txt);
            pushNotif(pid, "chat_message", taskId, task.type||"pre", task.title||"", preview);
          }
        }
      }
    } catch(ne) { console.warn("Chat notify error:", ne.message); }
    broadcast(req.params.taskId, { type: "message", msg });
    res.json(msg);
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD → R2
// ════════════════════════════════════════════════════════════════════════════════

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Нет файла" });
    const origName = req.file.originalname;
    // Keep original filename in key (only replace truly unsafe chars)
    const safeKey = `vinogradov/${Date.now()}_${origName.replace(/[^\w.\-а-яёА-ЯЁ]/gi, "_")}`;
    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         safeKey,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    const url = `${R2_PUBLIC_URL}/${safeKey}`;
    res.json({ url, key: safeKey, name: origName, size: req.file.size });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка загрузки: " + e.message }); }
});

// Download proxy — serve file from R2 through our server so browser can download it
app.get("/api/download", async (req, res) => {
  const { key, name } = req.query;
  if (!key) return res.status(400).send("key required");
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const fname = name || key.split("/").pop() || "file";
    res.setHeader("Content-Type",        obj.ContentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
    if (obj.ContentLength) res.setHeader("Content-Length", obj.ContentLength);
    // Stream body directly to client
    Readable.fromWeb(obj.Body.transformToWebStream()).pipe(res);
  } catch(e) {
    console.error("Download error:", e);
    if (!res.headersSent) res.status(500).send("Ошибка: " + e.message);
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// FALLBACK → React SPA
// ════════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════════
// AI  (OpenAI Whisper + GPT-4o)
// ════════════════════════════════════════════════════════════════════════════════

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

// ════════════════════════════════════════════════════════════════════════════════
// POST MY POST INTEGRATION
// ════════════════════════════════════════════════════════════════════════════════

const PMP_TOKEN = process.env.POSTMYPOST_TOKEN || "";
const PMP_BASE  = "https://api.postmypost.io/v4.1";

// Helper — authenticated PMP request
async function pmpFetch(path, method = "GET", body = null) {
  if (!PMP_TOKEN) throw new Error("POSTMYPOST_TOKEN не задан в переменных окружения Railway");
  const opts = {
    method,
    headers: { "Authorization": `Bearer ${PMP_TOKEN}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(PMP_BASE + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || `HTTP ${r.status}`);
  return data;
}

// GET /api/pmp/projects — list all PMP projects (to map Виноград project → PMP project)
app.get("/api/pmp/projects", async (req, res) => {
  try {
    const data = await pmpFetch("/projects");
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/pmp/channels?project_id=xxx — channels (accounts) in a PMP project
app.get("/api/pmp/channels", async (req, res) => {
  try {
    const qs = req.query.project_id ? `?project_id=${req.query.project_id}` : "";
    const data = await pmpFetch(`/channels${qs}`);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/pmp/upload — upload a file by URL to PMP project, returns file_id
// PMP file upload: POST /files/init { project_id, url } → { file_id, upload_url }
// Then: POST /files/complete { file_id }
app.post("/api/pmp/upload", async (req, res) => {
  try {
    const { file_url, file_name, pmp_project_id } = req.body;
    if (!file_url || !pmp_project_id) return res.status(400).json({ error: "file_url и pmp_project_id обязательны" });

    // Build absolute public URL for PMP to fetch
    const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : (process.env.APP_URL || "");
    const absoluteUrl = file_url.startsWith("http") ? file_url : appUrl + file_url;

    // Step 1: Init upload
    const init = await pmpFetch("/files/init", "POST", {
      project_id: Number(pmp_project_id),
      url: absoluteUrl,
    });
    const fileId = init?.data?.id || init?.id;
    if (!fileId) throw new Error("PMP не вернул file_id: " + JSON.stringify(init));

    // Step 2: Complete (for URL-based uploads PMP fetches the file itself, just confirm)
    try {
      await pmpFetch("/files/complete", "POST", { file_id: fileId });
    } catch(e) { /* some versions auto-complete */ }

    res.json({ file_id: fileId, raw: init });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/pmp/publish — create publication in PMP
// Body: { pmp_project_id, channel_ids[], post_at, text, hashtags, file_ids[], pub_type }
app.post("/api/pmp/publish", async (req, res) => {
  try {
    const { pmp_project_id, channel_ids, post_at, text, hashtags, file_ids, pub_type } = req.body;
    if (!pmp_project_id || !channel_ids?.length) {
      return res.status(400).json({ error: "pmp_project_id и channel_ids обязательны" });
    }

    const content = [text, hashtags].filter(Boolean).join("\n\n");

    // Map pub_type → PMP publication_type
    // 1=post, 2=story, 3=reels, 4=carousel (may vary — use 1 as safe default)
    const typeMap = { video: 3, carousel: 1, photo: 1, story: 2, reels: 3 };
    const pubType = typeMap[pub_type] || 1;

    const payload = {
      project_id: Number(pmp_project_id),
      post_at: post_at || null,        // null = publish immediately
      account_ids: channel_ids.map(Number),
      publication_status: 1,            // 1 = pending/scheduled
      details: channel_ids.map(id => ({
        account_id: Number(id),
        publication_type: pubType,
        content,
        ...(file_ids?.length ? { file_ids: file_ids.map(Number) } : {}),
      })),
    };

    const result = await pmpFetch("/publications", "POST", payload);
    res.json({ ok: true, publication_id: result?.data?.id || result?.id, raw: result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// TELEGRAM NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════════

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

async function tgNotify(chatId, text) {
  if (!TG_TOKEN || !chatId) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("TG sendMessage error:", err);
    }
  } catch(e) { console.error("TG notify failed:", e.message); }
}

async function notifyUser(userId, text) {
  if (!userId) return;
  try {
    const user = await q1("SELECT telegram_chat_id FROM users WHERE id=$1", [userId]);
    if (user?.telegram_chat_id) {
      console.log(`Notifying user ${userId} (chat_id=${user.telegram_chat_id})`);
      await tgNotify(user.telegram_chat_id, text);
    } else {
      console.log(`User ${userId} has no telegram_chat_id`);
    }
  } catch(e) { console.error("notifyUser error:", e.message); }
}

// ── Morning digest cron (9:00 daily) ─────────────────────────────────────────
const TG_GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID || "";

async function sendMorningDigest() {
  if (!TG_TOKEN || !TG_GROUP_CHAT_ID) {
    console.log("[DIGEST] Skipped — no TG_TOKEN or TELEGRAM_GROUP_CHAT_ID");
    return;
  }
  try {
    const allTasks = await q("SELECT * FROM tasks WHERE archived=false");
    const postTypes = ["post_reels","post_video","post_carousel"];
    const donePost = allTasks.filter(t => postTypes.includes(t.type) && t.status === "done").length;
    const inWorkPost = allTasks.filter(t => postTypes.includes(t.type) && ["in_progress","review","corrections"].includes(t.status)).length;
    const published = allTasks.filter(t => t.type === "pub" && t.status === "published").length;
    const readyToPub = allTasks.filter(t => t.type === "pub" && t.status !== "published").length;

    const today = new Date().toLocaleDateString("ru", { weekday:"long", day:"numeric", month:"long" });
    const text = `🍇 <b>Доброе утро! Сводка на ${today}</b>

`
      + `🎞 <b>Постпродакшн</b>
`
      + `  ✅ Смонтировано: <b>${donePost}</b>
`
      + `  🔄 В работе: <b>${inWorkPost}</b>

`
      + `🚀 <b>Публикации</b>
`
      + `  ✅ Опубликовано: <b>${published}</b>
`
      + `  📅 Готово к публикации: <b>${readyToPub}</b>`;

    await tgNotify(TG_GROUP_CHAT_ID, text);
    console.log("[DIGEST] Sent morning digest");
  } catch(e) {
    console.error("[DIGEST] Error:", e.message);
  }
}

// Schedule at 9:00 Moscow time (UTC+3) = 06:00 UTC
function scheduleMorningDigest() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(6, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntil = next - now;
  console.log(`[DIGEST] Next digest in ${Math.round(msUntil/60000)} min`);
  setTimeout(() => {
    sendMorningDigest();
    setInterval(sendMorningDigest, 24 * 60 * 60 * 1000);
  }, msUntil);
}
scheduleMorningDigest();

// ── Daily reel-stats auto-refresh (7:00 Moscow = 04:00 UTC) ──────────────────
async function refreshAllReelStats() {
  console.log("[REEL-CRON] Starting daily reel stats refresh...");
  try {
    // Get all published pub tasks with reel_url (not carousels)
    const tasks = await q(
      `SELECT * FROM tasks WHERE type='pub' AND status='published' AND archived=false`
    );
    let updated = 0, failed = 0;
    for (const task of tasks) {
      try {
        const data = typeof task.data === "string" ? JSON.parse(task.data) : (task.data || {});
        // Support multi-reel: reel_url, reel_url_1, reel_url_2...
        const urlKeys = Object.keys(data).filter(k => k === "reel_url" || k.match(/^reel_url_\d+$/));
        if (!urlKeys.length) continue;
        for (const urlKey of urlKeys) {
          const url = data[urlKey];
          if (!url) continue;
          try {
            const stats = await fetchReelStats(url);
            const id = uuidv4();
            await pool.query(
              `INSERT INTO reel_stats (id, task_id, reel_url, views, likes, comments, shares, reach)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [id, task.id, url, stats.views, stats.likes, stats.comments, stats.shares, stats.reach]
            );
            updated++;
          } catch(e) {
            console.warn(`[REEL-CRON] Failed ${task.id}/${urlKey}: ${e.message}`);
            failed++;
          }
          // Pause between requests to avoid rate-limiting
          await new Promise(r => setTimeout(r, 1200));
        }
      } catch(e) {
        console.warn(`[REEL-CRON] Skip task ${task.id}: ${e.message}`);
        failed++;
      }
    }
    console.log(`[REEL-CRON] Done: ${updated} updated, ${failed} failed`);
  } catch(e) {
    console.error("[REEL-CRON] Fatal error:", e.message);
  }
}

function scheduleReelStatsCron() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(4, 0, 0, 0); // 07:00 Moscow (UTC+3)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  const msUntil = next - now;
  console.log(`[REEL-CRON] Next auto-refresh in ${Math.round(msUntil/60000)} min (at 07:00 MSK)`);
  setTimeout(() => {
    refreshAllReelStats();
    setInterval(refreshAllReelStats, 24 * 60 * 60 * 1000);
  }, msUntil);
}
scheduleReelStatsCron();

// Build rich task notification text
async function taskNotifyText(taskId, action, fromUserId) {
  try {
    const task = await q1("SELECT * FROM tasks WHERE id=$1", [taskId]);
    const from = fromUserId ? await q1("SELECT name FROM users WHERE id=$1", [fromUserId]) : null;
    if (!task) return action;
    const proj = await q1("SELECT label FROM projects WHERE id=$1", [task.project_id]);
    const data = task.data || {};
    const deadline = data.deadline || data.post_deadline || data.shoot_date || data.planned_date || "";
    const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : (process.env.APP_URL || "");
    const link = appUrl ? ("\n\n🔗 <a href=\"" + appUrl + "\">Открыть Виноград</a>") : "";
    const parts = [action, "", "📋 <b>" + (task.title||"Без названия") + "</b>", "📁 Проект: " + (proj?.label||"?")];
    if (deadline) parts.push("📅 Дедлайн: " + deadline);
    if (from) parts.push("👤 От: " + from.name);
    return parts.join("\n") + link;
  } catch(e) { return action; }
}

// Webhook — Telegram sends updates here
// User just writes /start to the bot — no need to type username manually
app.post("/api/tg/webhook", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ ok: true });

    const chatId  = String(message.chat?.id || message.from?.id);
    const fromUsername = (message.from?.username || "").toLowerCase();
    const text    = (message.text || "").trim();

    console.log("TG webhook:", { chatId, fromUsername, text });

    if (text.startsWith("/start")) {
      // Try to match by Telegram @username stored in users.telegram
      // users.telegram stored as "evg_vinogradov" (without @)
      if (fromUsername) {
        const updated = await q(
          "UPDATE users SET telegram_chat_id=$1 WHERE LOWER(REPLACE(telegram,'@',''))=LOWER($2) RETURNING name",
          [chatId, fromUsername]
        );
        if (updated.rowCount > 0) {
          const name = updated.rows[0]?.name || fromUsername;
          await tgNotify(chatId, `✅ Привет, ${name}! Уведомления подключены.

Теперь ты будешь получать оповещения о новых задачах и сообщениях в чате.`);
          console.log(`Connected TG for @${fromUsername}, chat_id=${chatId}`);
        } else {
          await tgNotify(chatId, `❌ Пользователь @${fromUsername} не найден в системе.

Обратись к администратору — он должен добавить тебя в Виноград с тем же Telegram-ником.`);
          console.log(`TG user @${fromUsername} not found in DB`);
        }
      } else {
        await tgNotify(chatId, `👋 Привет! Чтобы подключить уведомления, убедись что в Telegram у тебя задан username (Настройки → Имя пользователя).`);
      }
    }
    res.json({ ok: true });
  } catch(e) {
    console.error("TG webhook error:", e);
    res.json({ ok: true }); // Always 200 to Telegram
  }
});

// Register webhook with Telegram (call once after deploy)
app.get("/api/tg/register-webhook", async (req, res) => {
  if (!TG_TOKEN) return res.status(503).json({ error: "TELEGRAM_BOT_TOKEN не задан" });
  const appUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.APP_URL || "";
  if (!appUrl) return res.status(400).json({ error: "Задайте APP_URL или деплойте на Railway" });

  const webhookUrl = `${appUrl}/api/tg/webhook`;
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
  });
  const data = await r.json();
  console.log("setWebhook result:", data);
  res.json({ webhookUrl, result: data });
});

// Check webhook + bot status
app.get("/api/tg/status", async (req, res) => {
  if (!TG_TOKEN) return res.json({ ok: false, error: "TELEGRAM_BOT_TOKEN не задан" });
  try {
    const [me, wh] = await Promise.all([
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/getMe`).then(r=>r.json()),
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo`).then(r=>r.json()),
    ]);
    // Count users with connected TG
    const connected = await q("SELECT COUNT(*) as cnt FROM users WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id != ''");
    res.json({
      bot: me.result,
      webhook: wh.result,
      connected_users: parseInt(connected[0]?.cnt || 0),
      token_set: true,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


async function openaiJson(body) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const e = await r.text(); throw new Error("OpenAI: " + e); }
  const d = await r.json();
  return d.choices[0].message.content;
}

// ── Транскрипция (Whisper) ─────────────────────────────────────────────────────
app.post("/api/ai/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(503).json({ error: "OPENAI_API_KEY не задан" });
    if (!req.file)   return res.status(400).json({ error: "Нет файла" });

    // Write uploaded video to temp file
    const tmpIn  = path.join(os.tmpdir(), `vg_in_${Date.now()}`  + path.extname(req.file.originalname || ".mp4"));
    const tmpOut = path.join(os.tmpdir(), `vg_out_${Date.now()}.mp3`);
    fs.writeFileSync(tmpIn, req.file.buffer);

    let audioBuffer;
    let audioName = req.file.originalname;

    try {
      // Extract & compress audio: mono, 64kbps — keeps file small for Whisper
      await execFileAsync("ffmpeg", [
        "-y", "-i", tmpIn,
        "-vn",               // no video
        "-ac", "1",          // mono
        "-ar", "16000",      // 16kHz (Whisper sweet spot)
        "-b:a", "64k",       // 64kbps → ~0.5MB/min
        tmpOut
      ]);
      audioBuffer = fs.readFileSync(tmpOut);
      audioName   = "audio.mp3";
    } catch (ffErr) {
      // ffmpeg not available or failed — send original file directly
      console.warn("ffmpeg unavailable, sending raw file:", ffErr.message);
      audioBuffer = req.file.buffer;
    } finally {
      try { fs.unlinkSync(tmpIn);  } catch {}
      try { fs.unlinkSync(tmpOut); } catch {}
    }

    // Whisper limit is 25MB
    if (audioBuffer.length > 24 * 1024 * 1024) {
      return res.status(413).json({ error: "Файл слишком большой (>24MB после сжатия). Попробуйте обрезать видео." });
    }

    const fd = new FormData();
    fd.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), audioName);
    fd.append("model", "whisper-1");
    fd.append("language", "ru");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
      body: fd,
    });
    if (!r.ok) { const e = await r.text(); throw new Error("Whisper: " + e); }
    const data = await r.json();
    res.json({ text: data.text });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── Биролы (GPT-4o) ────────────────────────────────────────────────────────────
app.post("/api/ai/birolls", async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(503).json({ error: "OPENAI_API_KEY не задан" });
    const { transcript, title } = req.body;
    if (!transcript) return res.status(400).json({ error: "Нет транскрипции" });

    const text = await openaiJson({
      model: "gpt-4o",
      max_tokens: 600,
      messages: [{
        role: "system",
        content: "Ты SMM-редактор. Твоя задача — предложить биролы (текстовые подписи на кадрах) для короткого видео. Формат: [0:00] текст подписи. Каждый бирол — отдельная строка. Не более 8 биролов. Только сам список без объяснений."
      }, {
        role: "user",
        content: `Видео: "${title || "Контент"}"\n\nТранскрипция:\n${transcript}\n\nПредложи биролы.`
      }]
    });
    res.json({ text });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── AI Сценарий (GPT-4o) ───────────────────────────────────────────────────────
app.post("/api/ai/script", async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(503).json({ error: "OPENAI_API_KEY не задан" });
    const { brief, title } = req.body;
    if (!brief) return res.status(400).json({ error: "Нет брифа" });

    const text = await openaiJson({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [{
        role: "system",
        content: "Ты сценарист коротких вертикальных видео для Instagram/TikTok. Пиши сценарии по сценам с таймкодами. Формат: Сцена N (0:00-0:05): [описание действия]\nТекст/монолог: [что говорит автор]. Итого не более 30 секунд видео."
      }, {
        role: "user",
        content: `Тема: "${title || "Видео"}"\n\nБриф:\n${brief}\n\nНапиши сценарий.`
      }]
    });
    res.json({ text });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── AI Caption (GPT-4o) ────────────────────────────────────────────────────────
app.post("/api/ai/caption", async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(503).json({ error: "OPENAI_API_KEY не задан" });
    const { title, project_label } = req.body;

    const text = await openaiJson({
      model: "gpt-4o",
      max_tokens: 300,
      messages: [{
        role: "system",
        content: "Ты SMM-копирайтер. Пиши живые, короткие подписи для Instagram. Без штампов. Добавь 1-2 эмодзи уместно. В конце — призыв к действию. Не более 150 слов."
      }, {
        role: "user",
        content: `Напиши подпись для публикации.\nНазвание: "${title || "Контент"}"\nБренд: "${project_label || ""}"`
      }]
    });
    res.json({ text });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ── Fallback → React SPA ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// ── НАСМОТРЕННОСТЬ — Inspiration API ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const RAPID_KEY = process.env.RAPIDAPI_KEY || "69435af1fcmshb4c74c0ac33da12p1496d4jsn17881f89c7a4";
const LOOTER_HOST = "instagram-looter2.p.rapidapi.com";

// ── DB init for inspiration ───────────────────────────────────────────────────
async function initInspirationDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inspiration_items (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      video_id TEXT,
      title TEXT,
      description TEXT,
      author TEXT,
      author_username TEXT,
      thumbnail TEXT,
      video_url TEXT,
      play_url TEXT,
      views BIGINT DEFAULT 0,
      likes BIGINT DEFAULT 0,
      comments BIGINT DEFAULT 0,
      shares BIGINT DEFAULT 0,
      duration INTEGER DEFAULT 0,
      published_at TEXT,
      source_query TEXT,
      source_type TEXT,
      starred BOOLEAN DEFAULT false,
      project_id TEXT,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS inspiration_searches (
      id TEXT PRIMARY KEY,
      platform TEXT,
      query TEXT,
      search_type TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
initInspirationDB().catch(console.error);

// helper: RapidAPI fetch
async function rapidFetch(url, headers = {}) {
  const https = require("https");
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "X-RapidAPI-Key": RAPID_KEY, "X-RapidAPI-Host": parsed.hostname, ...headers },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error("Invalid JSON: " + data.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── GET saved items ───────────────────────────────────────────────────────────
app.get("/api/inspiration", async (req, res) => {
  try {
    const { starred, project_id, platform, search } = req.query;
    let sql = "SELECT * FROM inspiration_items WHERE 1=1";
    const params = [];
    if (starred === "true") { params.push(true); sql += ` AND starred=$${params.length}`; }
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}`; }
    if (platform && platform !== "all") { params.push(platform); sql += ` AND platform=$${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length} OR description ILIKE $${params.length})`; }
    sql += " ORDER BY created_at DESC LIMIT 200";
    const items = await q(sql, params);
    res.json(items);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH item (star, note, project) ─────────────────────────────────────────
app.patch("/api/inspiration/:id", async (req, res) => {
  try {
    const { starred, note, project_id } = req.body;
    const fields = []; const vals = [];
    if (starred !== undefined) { vals.push(starred); fields.push(`starred=$${vals.length}`); }
    if (note !== undefined)    { vals.push(note);    fields.push(`note=$${vals.length}`); }
    if (project_id !== undefined) { vals.push(project_id); fields.push(`project_id=$${vals.length}`); }
    if (!fields.length) return res.json({ ok: true });
    vals.push(req.params.id);
    await pool.query(`UPDATE inspiration_items SET ${fields.join(",")} WHERE id=$${vals.length}`, vals);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE item ───────────────────────────────────────────────────────────────
app.delete("/api/inspiration/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM inspiration_items WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PARSE Instagram by username ───────────────────────────────────────────────
app.post("/api/inspiration/parse/instagram/user", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { username, count = 12 } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    const clean = username.replace(/^@/, "");

    // Instagram Looter2: first get user_id, then fetch reels
    const profileData = await rapidFetch(
      `https://${LOOTER_HOST}/profile2?username=${encodeURIComponent(clean)}`,
      { "X-RapidAPI-Host": LOOTER_HOST }
    );
    const userId = profileData?.id || profileData?.pk || profileData?.data?.id;
    if (!userId) throw new Error("Пользователь не найден: " + clean);

    const data = await rapidFetch(
      `https://${LOOTER_HOST}/reels?id=${userId}&count=${count}`,
      { "X-RapidAPI-Host": LOOTER_HOST }
    );

    const posts = data?.data || data?.items || (Array.isArray(data) ? data : []);
    const reels = posts.slice(0, count);

    const saved = [];
    for (const p of reels) {
      const id = uuidv4();
      const item = {
        id, platform: "instagram",
        video_id: p.id || p.pk || p.shortcode,
        title: (p.caption?.text || p.caption || "").slice(0, 300),
        description: (p.caption?.text || p.caption || "").slice(0, 1000),
        author: p.user?.full_name || p.owner?.full_name || clean,
        author_username: p.user?.username || p.owner?.username || clean,
        thumbnail: p.image_versions2?.candidates?.[0]?.url || p.thumbnail_url || p.display_url || "",
        video_url: `https://www.instagram.com/reel/${p.shortcode || p.code}/`,
        play_url: p.video_url || p.video_versions?.[0]?.url || "",
        views: p.play_count || p.view_count || p.video_view_count || 0,
        likes: p.like_count || p.edge_media_preview_like?.count || 0,
        comments: p.comment_count || p.edge_media_to_comment?.count || 0,
        shares: p.reshare_count || 0,
        duration: p.video_duration || 0,
        published_at: p.taken_at ? new Date(p.taken_at * 1000).toISOString() : (p.timestamp ? new Date(p.timestamp*1000).toISOString() : null),
        source_query: "@" + clean,
        source_type: "user",
      };
      await pool.query(
        `INSERT INTO inspiration_items (id,platform,video_id,title,description,author,author_username,thumbnail,video_url,play_url,views,likes,comments,shares,duration,published_at,source_query,source_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [item.id,item.platform,item.video_id,item.title,item.description,item.author,item.author_username,item.thumbnail,item.video_url,item.play_url,item.views,item.likes,item.comments,item.shares,item.duration,item.published_at,item.source_query,item.source_type]
      );
      saved.push(item);
    }
    await pool.query(`INSERT INTO inspiration_searches (id,platform,query,search_type) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), "instagram", "@"+clean, "user"]);
    res.json({ ok: true, count: saved.length, items: saved });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PARSE Instagram by hashtag ────────────────────────────────────────────────
app.post("/api/inspiration/parse/instagram/hashtag", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { hashtag, count = 12 } = req.body;
    if (!hashtag) return res.status(400).json({ error: "hashtag required" });
    const clean = hashtag.replace(/^#/, "");

    // Instagram Looter2 — hashtag
    const data = await rapidFetch(
      `https://${LOOTER_HOST}/tag-feeds?query=${encodeURIComponent(clean)}`,
      { "X-RapidAPI-Host": LOOTER_HOST }
    );

    // tag-feeds returns {data: {medias: []}} or similar
    const rawItems = data?.data?.medias || data?.data?.items || data?.data || data?.items || (Array.isArray(data) ? data : []);
    const reels = rawItems.filter(p => p.is_video || p.media_type === 2 || p.__typename === "GraphVideo" || p.video_url).slice(0, count);

    const saved = [];
    for (const p of reels) {
      const id = uuidv4();
      const item = {
        id, platform: "instagram",
        video_id: p.id || p.pk || p.shortcode,
        title: (p.caption?.text || p.edge_media_to_caption?.edges?.[0]?.node?.text || "").slice(0, 300),
        description: (p.caption?.text || p.edge_media_to_caption?.edges?.[0]?.node?.text || "").slice(0, 1000),
        author: p.user?.full_name || p.owner?.full_name || "",
        author_username: p.user?.username || p.owner?.username || "",
        thumbnail: p.image_versions2?.candidates?.[0]?.url || p.display_url || p.thumbnail_url || "",
        video_url: `https://www.instagram.com/reel/${p.shortcode || p.code}/`,
        play_url: p.video_url || p.video_versions?.[0]?.url || "",
        views: p.play_count || p.video_view_count || 0,
        likes: p.like_count || p.edge_media_preview_like?.count || 0,
        comments: p.comment_count || p.edge_media_to_comment?.count || 0,
        shares: 0,
        duration: p.video_duration || 0,
        published_at: p.taken_at ? new Date(p.taken_at * 1000).toISOString() : null,
        source_query: "#" + clean,
        source_type: "hashtag",
      };
      await pool.query(
        `INSERT INTO inspiration_items (id,platform,video_id,title,description,author,author_username,thumbnail,video_url,play_url,views,likes,comments,shares,duration,published_at,source_query,source_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [item.id,item.platform,item.video_id,item.title,item.description,item.author,item.author_username,item.thumbnail,item.video_url,item.play_url,item.views,item.likes,item.comments,item.shares,item.duration,item.published_at,item.source_query,item.source_type]
      );
      saved.push(item);
    }
    await pool.query(`INSERT INTO inspiration_searches (id,platform,query,search_type) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), "instagram", "#"+clean, "hashtag"]);
    res.json({ ok: true, count: saved.length, items: saved });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PARSE TikTok by username ──────────────────────────────────────────────────
app.post("/api/inspiration/parse/tiktok/user", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { username, count = 12 } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    const clean = username.replace(/^@/, "");

    const data = await rapidFetch(
      `https://tiktok-api23.p.rapidapi.com/api/user/posts?uniqueId=${encodeURIComponent(clean)}&count=${count}&cursor=0`,
      { "X-RapidAPI-Host": "tiktok-api23.p.rapidapi.com" }
    );

    const items = data?.data?.itemList || data?.itemList || [];
    const saved = [];
    for (const v of items.slice(0, count)) {
      const id = uuidv4();
      const item = {
        id, platform: "tiktok",
        video_id: v.id,
        title: (v.desc || "").slice(0, 300),
        description: (v.desc || "").slice(0, 1000),
        author: v.author?.nickname || clean,
        author_username: v.author?.uniqueId || clean,
        thumbnail: v.video?.cover || v.video?.originCover || "",
        video_url: `https://www.tiktok.com/@${v.author?.uniqueId || clean}/video/${v.id}`,
        play_url: v.video?.playAddr || "",
        views: v.stats?.playCount || 0,
        likes: v.stats?.diggCount || 0,
        comments: v.stats?.commentCount || 0,
        shares: v.stats?.shareCount || 0,
        duration: v.video?.duration || 0,
        published_at: v.createTime ? new Date(v.createTime * 1000).toISOString() : null,
        source_query: "@" + clean,
        source_type: "user",
      };
      await pool.query(
        `INSERT INTO inspiration_items (id,platform,video_id,title,description,author,author_username,thumbnail,video_url,play_url,views,likes,comments,shares,duration,published_at,source_query,source_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [item.id,item.platform,item.video_id,item.title,item.description,item.author,item.author_username,item.thumbnail,item.video_url,item.play_url,item.views,item.likes,item.comments,item.shares,item.duration,item.published_at,item.source_query,item.source_type]
      );
      saved.push(item);
    }
    await pool.query(`INSERT INTO inspiration_searches (id,platform,query,search_type) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), "tiktok", "@"+clean, "user"]);
    res.json({ ok: true, count: saved.length, items: saved });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PARSE TikTok by keyword ───────────────────────────────────────────────────
app.post("/api/inspiration/parse/tiktok/keyword", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { keyword, count = 12 } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword required" });

    const data = await rapidFetch(
      `https://tiktok-api23.p.rapidapi.com/api/search/video?keywords=${encodeURIComponent(keyword)}&count=${count}&cursor=0&region=RU&publish_time=0&sort_type=0`,
      { "X-RapidAPI-Host": "tiktok-api23.p.rapidapi.com" }
    );

    const items = data?.data?.itemList || data?.itemList || [];
    const saved = [];
    for (const v of items.slice(0, count)) {
      const id = uuidv4();
      const item = {
        id, platform: "tiktok",
        video_id: v.id,
        title: (v.desc || "").slice(0, 300),
        description: (v.desc || "").slice(0, 1000),
        author: v.author?.nickname || "",
        author_username: v.author?.uniqueId || "",
        thumbnail: v.video?.cover || "",
        video_url: `https://www.tiktok.com/@${v.author?.uniqueId}/video/${v.id}`,
        play_url: v.video?.playAddr || "",
        views: v.stats?.playCount || 0,
        likes: v.stats?.diggCount || 0,
        comments: v.stats?.commentCount || 0,
        shares: v.stats?.shareCount || 0,
        duration: v.video?.duration || 0,
        published_at: v.createTime ? new Date(v.createTime * 1000).toISOString() : null,
        source_query: keyword,
        source_type: "keyword",
      };
      await pool.query(
        `INSERT INTO inspiration_items (id,platform,video_id,title,description,author,author_username,thumbnail,video_url,play_url,views,likes,comments,shares,duration,published_at,source_query,source_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [item.id,item.platform,item.video_id,item.title,item.description,item.author,item.author_username,item.thumbnail,item.video_url,item.play_url,item.views,item.likes,item.comments,item.shares,item.duration,item.published_at,item.source_query,item.source_type]
      );
      saved.push(item);
    }
    await pool.query(`INSERT INTO inspiration_searches (id,platform,query,search_type) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), "tiktok", keyword, "keyword"]);
    res.json({ ok: true, count: saved.length, items: saved });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PARSE YouTube by channel ──────────────────────────────────────────────────
app.post("/api/inspiration/parse/youtube/channel", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { channel, count = 12 } = req.body;
    if (!channel) return res.status(400).json({ error: "channel required" });
    const clean = channel.replace(/^@/, "");

    const data = await rapidFetch(
      `https://yt-api.p.rapidapi.com/channel/videos?id=@${encodeURIComponent(clean)}`,
      { "X-RapidAPI-Host": "yt-api.p.rapidapi.com" }
    );

    const videos = data?.data || [];
    const saved = [];
    for (const v of videos.slice(0, count)) {
      const id = uuidv4();
      const item = {
        id, platform: "youtube",
        video_id: v.videoId,
        title: (v.title || "").slice(0, 300),
        description: (v.description || "").slice(0, 1000),
        author: v.channelTitle || clean,
        author_username: clean,
        thumbnail: v.thumbnail?.[0]?.url || "",
        video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
        play_url: "",
        views: parseInt(v.viewCount) || 0,
        likes: 0,
        comments: parseInt(v.commentCount) || 0,
        shares: 0,
        duration: 0,
        published_at: v.publishedTimeText || null,
        source_query: "@" + clean,
        source_type: "channel",
      };
      await pool.query(
        `INSERT INTO inspiration_items (id,platform,video_id,title,description,author,author_username,thumbnail,video_url,play_url,views,likes,comments,shares,duration,published_at,source_query,source_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [item.id,item.platform,item.video_id,item.title,item.description,item.author,item.author_username,item.thumbnail,item.video_url,item.play_url,item.views,item.likes,item.comments,item.shares,item.duration,item.published_at,item.source_query,item.source_type]
      );
      saved.push(item);
    }
    await pool.query(`INSERT INTO inspiration_searches (id,platform,query,search_type) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), "youtube", "@"+clean, "channel"]);
    res.json({ ok: true, count: saved.length, items: saved });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PARSE YouTube by keyword ──────────────────────────────────────────────────
app.post("/api/inspiration/parse/youtube/keyword", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { keyword, count = 12 } = req.body;
    if (!keyword) return res.status(400).json({ error: "keyword required" });

    const data = await rapidFetch(
      `https://yt-api.p.rapidapi.com/search?query=${encodeURIComponent(keyword)}&type=video`,
      { "X-RapidAPI-Host": "yt-api.p.rapidapi.com" }
    );

    const videos = (data?.data || []).filter(v => v.type === "video");
    const saved = [];
    for (const v of videos.slice(0, count)) {
      const id = uuidv4();
      const item = {
        id, platform: "youtube",
        video_id: v.videoId,
        title: (v.title || "").slice(0, 300),
        description: (v.description || "").slice(0, 1000),
        author: v.channelTitle || "",
        author_username: v.channelHandle?.replace("@","") || "",
        thumbnail: v.thumbnail?.[0]?.url || "",
        video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
        play_url: "",
        views: parseInt(v.viewCount) || 0,
        likes: 0,
        comments: 0,
        shares: 0,
        duration: 0,
        published_at: v.publishedTimeText || null,
        source_query: keyword,
        source_type: "keyword",
      };
      await pool.query(
        `INSERT INTO inspiration_items (id,platform,video_id,title,description,author,author_username,thumbnail,video_url,play_url,views,likes,comments,shares,duration,published_at,source_query,source_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO NOTHING`,
        [item.id,item.platform,item.video_id,item.title,item.description,item.author,item.author_username,item.thumbnail,item.video_url,item.play_url,item.views,item.likes,item.comments,item.shares,item.duration,item.published_at,item.source_query,item.source_type]
      );
      saved.push(item);
    }
    await pool.query(`INSERT INTO inspiration_searches (id,platform,query,search_type) VALUES ($1,$2,$3,$4)`,
      [uuidv4(), "youtube", keyword, "keyword"]);
    res.json({ ok: true, count: saved.length, items: saved });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SEARCH Instagram accounts (looter2 /search) ───────────────────────────────
app.get("/api/inspiration/instagram/search-accounts", async (req, res) => {
  try {
    if (!RAPID_KEY) return res.status(400).json({ error: "RAPIDAPI_KEY not set" });
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "query required" });
    const data = await rapidFetch(
      `https://${LOOTER_HOST}/search?query=${encodeURIComponent(query)}`,
      { "X-RapidAPI-Host": LOOTER_HOST }
    );
    // Returns users array
    const users = data?.users || data?.data?.users || data?.accounts || (Array.isArray(data) ? data : []);
    res.json(users.slice(0, 10).map(u => ({
      username: u.username || u.user?.username,
      full_name: u.full_name || u.user?.full_name,
      followers: u.follower_count || u.edge_followed_by?.count || 0,
      profile_pic: u.profile_pic_url || u.user?.profile_pic_url,
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DEBUG: test looter2 endpoints ────────────────────────────────────────────
app.get("/api/inspiration/debug", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url required" });
    const data = await rapidFetch(url, { "X-RapidAPI-Host": LOOTER_HOST });
    res.json({ url, keys: Object.keys(data), sample: JSON.stringify(data).slice(0, 2000) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET search history ────────────────────────────────────────────────────────
app.get("/api/inspiration/searches", async (req, res) => {
  try {
    const rows = await q("SELECT * FROM inspiration_searches ORDER BY created_at DESC LIMIT 50");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── REEL STATS — автосбор статистики публикаций ───────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const LOOTER_KEY  = process.env.RAPIDAPI_KEY || "69435af1fcmshb4c74c0ac33da12p1496d4jsn17881f89c7a4";
const LOOTER_HOST2 = "instagram-looter2.p.rapidapi.com";

async function looterFetch(url) {
  const https = require("https");
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "X-RapidAPI-Key": LOOTER_KEY,
        "X-RapidAPI-Host": parsed.hostname,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error("Invalid JSON: " + data.slice(0, 300))); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}


app.get("/api/reel-stats/debug", async (req, res) => {
  try {
    const { url, endpoint } = req.query;
    if (!url) return res.status(400).json({ error: "url required" });
    const ep = endpoint || "post-dl";
    const full = `https://${LOOTER_HOST2}/${ep}?url=${encodeURIComponent(url)}`;
    const data = await looterFetch(full);
    res.json({ endpoint: ep, full_url: full, keys: Object.keys(data||{}), data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// ── DB init ───────────────────────────────────────────────────────────────────
async function initReelStatsDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reel_stats (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      reel_url TEXT NOT NULL,
      platform TEXT DEFAULT 'instagram',
      views BIGINT DEFAULT 0,
      likes BIGINT DEFAULT 0,
      comments BIGINT DEFAULT 0,
      shares BIGINT DEFAULT 0,
      reach BIGINT DEFAULT 0,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS reel_stats_task_idx ON reel_stats(task_id);
    CREATE INDEX IF NOT EXISTS reel_stats_recorded_idx ON reel_stats(recorded_at);
  `);
}
initReelStatsDB().catch(console.error);

// ── Fetch stats for one URL ───────────────────────────────────────────────────
async function fetchReelStats(reelUrl) {
  // "Media info by URL" = /post?url= (correct endpoint from RapidAPI docs)
  const d = await looterFetch(
    `https://${LOOTER_HOST2}/post?url=${encodeURIComponent(reelUrl)}`
  );
  console.log("[reel-stats] /post keys:", Object.keys(d||{}).slice(0,10).join(","));
  console.log("[reel-stats] video_play_count:", d?.video_play_count, "likes:", d?.edge_media_preview_like?.count, "like_count:", d?.like_count);
  return {
    views:    parseInt(d?.video_play_count || d?.video_view_count || 0),
    likes:    parseInt(d?.edge_media_preview_like?.count || d?.like_count || 0),
    comments: parseInt(d?.edge_media_to_parent_comment?.count || d?.edge_media_preview_comment?.count || d?.comment_count || 0),
    shares:   parseInt(d?.reshare_count || d?.share_count || 0),
    reach:    parseInt(d?.video_view_count || 0),
  };
}

// ── Manual refresh for one task ───────────────────────────────────────────────
app.post("/api/reel-stats/refresh/:taskId", async (req, res) => {
  try {
    const task = await q1("SELECT * FROM tasks WHERE id=$1", [req.params.taskId]);
    if (!task) return res.status(404).json({ error: "Task not found" });
    // data может прийти строкой из БД
    const taskData = typeof task.data === "string" ? JSON.parse(task.data) : (task.data || {});
    // Используем url_key из запроса (reel_url, reel_url_1, reel_url_2 ...) или дефолт reel_url
    const urlKey = req.body?.url_key || "reel_url";
    const reelUrl = taskData[urlKey];
    if (!reelUrl) return res.status(400).json({ error: `reel_url not set for key: ${urlKey}`, available_keys: Object.keys(taskData).filter(k=>k.startsWith("reel_url")) });

    const stats = await fetchReelStats(reelUrl);
    const id = uuidv4();
    await pool.query(
      `INSERT INTO reel_stats (id, task_id, reel_url, views, likes, comments, shares, reach)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, task.id, reelUrl, stats.views, stats.likes, stats.comments, stats.shares, stats.reach]
    );
    res.json({ ok: true, stats, recorded_at: new Date().toISOString() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET history for one task ──────────────────────────────────────────────────
app.get("/api/reel-stats/:taskId", async (req, res) => {
  try {
    const rows = await q(
      "SELECT * FROM reel_stats WHERE task_id=$1 ORDER BY recorded_at ASC",
      [req.params.taskId]
    );
    const parsed = rows.map(r => ({
      ...r,
      views:    parseInt(r.views)    || 0,
      likes:    parseInt(r.likes)    || 0,
      comments: parseInt(r.comments) || 0,
      shares:   parseInt(r.shares)   || 0,
      reach:    parseInt(r.reach)    || 0,
    }));
    res.json(parsed);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET latest snapshot for multiple tasks (for card badges) ──────────────────
app.post("/api/reel-stats/latest", async (req, res) => {
  try {
    const { task_ids } = req.body;
    if (!task_ids?.length) return res.json({});
    // Latest snapshot per task_id
    const rows = await q(
      `SELECT DISTINCT ON (task_id) task_id, views, likes, comments, shares, reach, recorded_at
       FROM reel_stats
       WHERE task_id = ANY($1)
       ORDER BY task_id, recorded_at DESC`,
      [task_ids]
    );
    const map = {};
    rows.forEach(r => {
      map[r.task_id] = {
        ...r,
        views:    parseInt(r.views)    || 0,
        likes:    parseInt(r.likes)    || 0,
        comments: parseInt(r.comments) || 0,
        shares:   parseInt(r.shares)   || 0,
        reach:    parseInt(r.reach)    || 0,
      };
    });
    res.json(map);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET all tracked reels (for analytics page) ────────────────────────────────
app.get("/api/reel-stats", async (req, res) => {
  try {
    // Latest snapshot per task + task info
    const rows = await q(`
      SELECT DISTINCT ON (rs.task_id)
        rs.task_id, rs.views, rs.likes, rs.comments, rs.shares, rs.reach, rs.recorded_at,
        t.title, t.project_id, t.data
      FROM reel_stats rs
      JOIN tasks t ON t.id = rs.task_id
      ORDER BY rs.task_id, rs.recorded_at DESC
    `);
    const parsed = rows.map(r => ({
      ...r,
      views:    parseInt(r.views)    || 0,
      likes:    parseInt(r.likes)    || 0,
      comments: parseInt(r.comments) || 0,
      shares:   parseInt(r.shares)   || 0,
      reach:    parseInt(r.reach)    || 0,
    }));
    res.json(parsed);
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── DEBUG: check task data and raw API response ───────────────────────────────
app.get("/api/reel-stats/debug/:taskId", async (req, res) => {
  try {
    const task = await q1("SELECT * FROM tasks WHERE id=$1", [req.params.taskId]);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const taskData = typeof task.data === "string" ? JSON.parse(task.data) : (task.data || {});
    const reelUrl = taskData.reel_url;
    if (!reelUrl) return res.json({ error: "no reel_url", taskData });
    const raw = await looterFetch(`https://${LOOTER_HOST2}/post-info?url=${encodeURIComponent(reelUrl)}`);
    res.json({ reelUrl, taskData, raw_keys: Object.keys(raw?.data || raw || {}), raw });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// ── CRON: auto-refresh all tracked reels every 24h ───────────────────────────
async function cronRefreshAllReels() {
  try {
    // Find all pub tasks with reel_url set
    const tasks = await q(
      `SELECT id, data FROM tasks WHERE type='pub' AND data->>'reel_url' IS NOT NULL AND data->>'reel_url' != ''`
    );
    console.log(`[cron] Refreshing reel stats for ${tasks.length} tasks`);
    for (const task of tasks) {
      try {
        const stats = await fetchReelStats(task.data.reel_url);
        await pool.query(
          `INSERT INTO reel_stats (id, task_id, reel_url, views, likes, comments, shares, reach)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv4(), task.id, task.data.reel_url, stats.views, stats.likes, stats.comments, stats.shares, stats.reach]
        );
        // Throttle: 1s between requests
        await new Promise(r => setTimeout(r, 1000));
      } catch(e) {
        console.error(`[cron] Failed for task ${task.id}:`, e.message);
      }
    }
    console.log(`[cron] Done refreshing reel stats`);
  } catch(e) {
    console.error("[cron] cronRefreshAllReels error:", e.message);
  }
}

// Run cron every 24 hours
setInterval(cronRefreshAllReels, 24 * 60 * 60 * 1000);
// Also run once 30s after server start
setTimeout(cronRefreshAllReels, 30000);

// ── Debug reel endpoints ──────────────────────────────────────────────────────
app.get("/api/reel-debug", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });
  const endpoints = ["post-dl", "media", "post", "reel", "shortcode", "media-by-url"];
  const results = {};
  for (const ep of endpoints) {
    try {
      const data = await looterFetch(`https://${LOOTER_HOST2}/${ep}?url=${encodeURIComponent(url)}`);
      const d = data?.data || data;
      results[ep] = {
        keys: Object.keys(d || data || {}),
        play_count: d?.video_play_count || d?.play_count || d?.view_count || "—",
        likes: d?.edge_media_preview_like?.count || d?.like_count || "—",
        raw: JSON.stringify(data).slice(0, 300),
      };
    } catch(e) {
      results[ep] = { error: e.message };
    }
  }
  res.json(results);
});


app.get("*", (req, res) => {
  const index = path.join(BUILD_PATH, "index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.json({ status: "Виноград API running 🍇" });
});

// ── Сброс пароля ─────────────────────────────────────────────────────────────
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { telegram, new_password, invite_password } = req.body;
    if (invite_password !== INVITE_PASSWORD) return res.status(403).json({ error: "Неверный код приглашения" });
    if (!telegram || !new_password) return res.status(400).json({ error: "Заполните все поля" });
    const clean = telegram.replace(/^@/, "").toLowerCase().trim();
    const user = await q1("SELECT id FROM users WHERE telegram=$1", [clean]);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    await q("UPDATE users SET password_hash=$1 WHERE id=$2", [new_password, user.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Stickers (Интелект-доска) ─────────────────────────────────────────────────
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS stickers (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT 'all',
    text TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#fbbf24',
    x FLOAT NOT NULL DEFAULT 100,
    y FLOAT NOT NULL DEFAULT 100,
    w FLOAT NOT NULL DEFAULT 200,
    h FLOAT NOT NULL DEFAULT 150,
    author_id TEXT,
    created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000,
    updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
  )`);
})().catch(console.error);

app.get("/api/stickers", async (req, res) => {
  try {
    const { project_id } = req.query;
    const rows = project_id && project_id !== "all"
      ? await q("SELECT * FROM stickers WHERE project_id=$1 ORDER BY created_at ASC", [project_id])
      : await q("SELECT * FROM stickers ORDER BY created_at ASC");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/stickers", async (req, res) => {
  try {
    const { id, project_id="all", text="", color="#fbbf24", x=100, y=100, w=200, h=150, author_id="" } = req.body;
    const now = Date.now();
    const row = await q1(
      `INSERT INTO stickers (id,project_id,text,color,x,y,w,h,author_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
      [id, project_id, text, color, x, y, w, h, author_id, now]
    );
    res.json(row);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/stickers/:id", async (req, res) => {
  try {
    const fields = ["text","color","x","y","w","h","project_id"];
    const sets = ["updated_at=$1"]; const vals = [Date.now()]; let i = 2;
    for (const f of fields) { if (req.body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    vals.push(req.params.id);
    await q(`UPDATE stickers SET ${sets.join(",")} WHERE id=$${i}`, vals);
    const row = await q1("SELECT * FROM stickers WHERE id=$1", [req.params.id]);
    res.json(row);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/stickers/:id", async (req, res) => {
  try {
    await q("DELETE FROM stickers WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Sticker Arrows ────────────────────────────────────────────────────────────
app.get("/api/sticker-arrows", async (req, res) => {
  try {
    const rows = await q("SELECT id, from_id as \"from\", to_id as \"to\" FROM sticker_arrows ORDER BY created_at ASC");
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/sticker-arrows", async (req, res) => {
  try {
    const { id, from, to } = req.body;
    const row = await q1(
      `INSERT INTO sticker_arrows (id, from_id, to_id) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO NOTHING RETURNING id, from_id as "from", to_id as "to"`,
      [id, from, to]
    );
    res.json(row || { id, from, to });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// NOTE: specific route MUST come before /:id
app.delete("/api/sticker-arrows/by-sticker/:stickerId", async (req, res) => {
  try {
    await q("DELETE FROM sticker_arrows WHERE from_id=$1 OR to_id=$1", [req.params.stickerId]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/sticker-arrows/:id", async (req, res) => {
  try {
    await q("DELETE FROM sticker_arrows WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initDb()
  .then(() => server.listen(PORT, () => console.log(`🍇 Виноград server on port ${PORT}`)))
  .catch(err => { console.error("DB init failed:", err); process.exit(1); });
