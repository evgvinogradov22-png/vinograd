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

const BUILD_PATH = path.join(__dirname, "..", "client", "build");
if (fs.existsSync(BUILD_PATH)) app.use(express.static(BUILD_PATH));

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h.toString(36);
}

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
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pmp_project_id TEXT DEFAULT ''`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_type    ON tasks(type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_task     ON chat_messages(task_id)`);

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
    if (!type || !project_id) return res.status(400).json({ error: "type и project_id обязательны" });
    const id = "t_" + uuidv4().replace(/-/g, "").slice(0, 10);
    const now = Date.now();
    await q("INSERT INTO tasks(id,type,title,project_id,status,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, type, title || "", project_id, status || "idea", JSON.stringify(data || {}), now, now]);
    const saved = await q1("SELECT * FROM tasks WHERE id=$1", [id]);
    // Notify assignees about new task
    if (saved) {
      const taskData = data || {};
      const assignees = ["producer","editor","scriptwriter","operator","designer","customer","executor"]
        .map(f => taskData[f]).filter(Boolean);
      for (const uid of [...new Set(assignees)]) {
        await notifyUser(uid, `📋 Новая задача назначена на вас:\n<b>${title||"Без названия"}</b>`);
      }
    }
    res.json(saved);
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка" }); }
});

app.patch("/api/tasks/:id", async (req, res) => {
  try {
    const { title, project_id, status, data, archived, completed_at } = req.body;
    const now = Date.now();
    // Build dynamic update to avoid overwriting fields not passed
    const sets = ["updated_at=$1"];
    const vals = [now];
    let i = 2;
    if (title      !== undefined) { sets.push(`title=$${i++}`);      vals.push(title); }
    if (project_id !== undefined) { sets.push(`project_id=$${i++}`); vals.push(project_id); }
    if (status     !== undefined) { sets.push(`status=$${i++}`);     vals.push(status); }
    if (data       !== undefined) { sets.push(`data=$${i++}`);       vals.push(JSON.stringify(data)); }
    if (archived      !== undefined) { sets.push(`archived=$${i++}`);      vals.push(archived); }
    if (completed_at  !== undefined) { sets.push(`completed_at=$${i++}`); vals.push(completed_at); }
    vals.push(req.params.id);
    await q(`UPDATE tasks SET ${sets.join(",")} WHERE id=$${i}`, vals);
    const updated = await q1("SELECT * FROM tasks WHERE id=$1", [req.params.id]);
    res.json(updated);

    // Smart notifications
    const reqUser = req.headers["x-user-id"] || "";
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
      const task = await q1("SELECT * FROM tasks WHERE id=$1", [req.params.taskId]);
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
app.get("*", (req, res) => {
  const index = path.join(BUILD_PATH, "index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.json({ status: "Виноград API running 🍇" });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initDb()
  .then(() => server.listen(PORT, () => console.log(`🍇 Виноград server on port ${PORT}`)))
  .catch(err => { console.error("DB init failed:", err); process.exit(1); });
