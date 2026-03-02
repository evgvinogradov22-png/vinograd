const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");
const multer = require("multer");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const BUILD_PATH = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(BUILD_PATH)) app.use(express.static(BUILD_PATH));

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h.toString(36);
}

// ── Init DB ───────────────────────────────────────────────────────────────────
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Оператор',
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      password_hash TEXT NOT NULL,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      description TEXT DEFAULT '',
      links JSONB DEFAULT '[]',
      archived BOOLEAN DEFAULT FALSE,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      data JSONB DEFAULT '{}',
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
      updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT DEFAULT '',
      file_url TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_type    ON tasks(type);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_task     ON chat_messages(task_id);
  `);

  // Seed projects
  await pool.query(`
    INSERT INTO projects (id, label, color, description) VALUES
      ('brandx',  'Brand X',     '#ef4444', 'Бренд зимней одежды. ЦА: женщины 25-35.'),
      ('techco',  'TechCo',      '#3b82f6', 'IT-компания. Офисный контент.'),
      ('fashion', 'Fashion Lab', '#ec4899', 'Мода и стиль, сезонные коллекции.'),
      ('eco',     'EcoStore',    '#10b981', 'Экотовары. Тон: вдохновляющий.')
    ON CONFLICT (id) DO NOTHING;
  `);

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
    } catch {}
  });
  ws.on("close", () => clients.delete(ws));
});

function broadcast(taskId, payload) {
  const data = JSON.stringify(payload);
  for (const [ws, info] of clients) {
    if (info.taskId === taskId && ws.readyState === 1) {
      ws.send(data);
    }
  }
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
      [id, clean, name || clean, role || "Оператор", color || "#8b5cf6", hash(password + clean)]);
    res.json({ id, telegram: clean, name: name || clean, role: role || "Оператор", color: color || "#8b5cf6" });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка сервера" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { telegram, password } = req.body;
    const clean = telegram.replace(/^@/, "").toLowerCase().trim();
    const user = await q1("SELECT * FROM users WHERE telegram=$1", [clean]);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    if (hash(password + clean) !== user.password_hash) return res.status(401).json({ error: "Неверный пароль" });
    res.json({ id: user.id, telegram: user.telegram, name: user.name, role: user.role, color: user.color });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка сервера" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// USERS (team)
// ════════════════════════════════════════════════════════════════════════════════

app.get("/api/users", async (req, res) => {
  try { res.json(await q("SELECT id,telegram,name,role,color FROM users ORDER BY created_at")); }
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
    const { label, color, description, links, archived } = req.body;
    await q(`UPDATE projects SET
      label       = COALESCE($1, label),
      color       = COALESCE($2, color),
      description = COALESCE($3, description),
      links       = COALESCE($4, links),
      archived    = COALESCE($5, archived)
      WHERE id = $6`,
      [label, color, description, links ? JSON.stringify(links) : null, archived, req.params.id]);
    res.json(await q1("SELECT * FROM projects WHERE id=$1", [req.params.id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await q("DELETE FROM tasks WHERE project_id=$1", [req.params.id]);
    await q("DELETE FROM projects WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
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
    if (!type || !project_id) return res.status(400).json({ error: "type и project_id обязательны" });
    const id = "t_" + uuidv4().replace(/-/g, "").slice(0, 10);
    const now = Date.now();
    await q("INSERT INTO tasks(id,type,title,project_id,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, type, title || "", project_id, status || "idea", JSON.stringify(data || {}), now, now]);
    res.json(await q1("SELECT * FROM tasks WHERE id=$1", [id]));
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка" }); }
});

app.patch("/api/tasks/:id", async (req, res) => {
  try {
    const { title, project_id, status, data } = req.body;
    const now = Date.now();
    await q(`UPDATE tasks SET
      title      = COALESCE($1, title),
      project_id = COALESCE($2, project_id),
      status     = COALESCE($3, status),
      data       = COALESCE($4, data),
      updated_at = $5
      WHERE id = $6`,
      [title, project_id, status, data ? JSON.stringify(data) : null, now, req.params.id]);
    res.json(await q1("SELECT * FROM tasks WHERE id=$1", [req.params.id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
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
    res.json(await q("SELECT * FROM chat_messages WHERE task_id=$1 ORDER BY created_at", [req.params.taskId]));
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
    const key = `vinogradov/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    const url = `${R2_PUBLIC_URL}/${key}`;
    res.json({ url, key, name: req.file.originalname, size: req.file.size });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка загрузки" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// FALLBACK → React SPA
// ════════════════════════════════════════════════════════════════════════════════

app.get("*", (req, res) => {
  const index = path.join(BUILD_PATH, "index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.json({ status: "Виноград API running 🍇" });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initDb()
  .then(() => server.listen(PORT, () => console.log(`🍇 Виноград server on port ${PORT}`)))
  .catch(err => { console.error("DB init failed:", err); process.exit(1); });
