const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const { type, project_id, limit, offset, archived } = req.query;
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params = [];
    if (type)       { params.push(type);       sql += ` AND type=$${params.length}`; }
    if (project_id) { params.push(project_id); sql += ` AND project_id=$${params.length}`; }
    // By default only load active tasks — archived loaded separately on demand
    if (archived === "true") {
      sql += " AND archived=true";
    } else if (archived !== "all") {
      sql += " AND archived=false";
    }
    sql += " ORDER BY updated_at DESC NULLS LAST, created_at DESC";
    // Pagination — default: all active tasks (no limit for now, add when task count grows)
    const lim = parseInt(limit) || null;
    const off = parseInt(offset) || 0;
    if (lim) {
      params.push(lim); sql += ` LIMIT $${params.length}`;
      params.push(off); sql += ` OFFSET $${params.length}`;
    }
    const rows = await q(sql, params);
    // Return count for pagination UI
    if (lim) {
      const countSql = sql.replace("SELECT *", "SELECT COUNT(*)").replace(/LIMIT.+/, "");
      const total = await q1(countSql.replace(` LIMIT $${params.length-1} OFFSET $${params.length}`, ""), params.slice(0, -2));
      return res.json({ tasks: rows, total: parseInt(total?.count || 0), offset: off, limit: lim });
    }
    res.json(rows);
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка" }); }
});

router.post("/api/tasks", requireAuth, async (req, res) => {
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

router.patch("/api/tasks/:id", requireAuth, async (req, res) => {
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

router.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    await q("DELETE FROM chat_messages WHERE task_id=$1", [req.params.id]);
    await q("DELETE FROM tasks WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// SEND TO PUB — transactional: create pub task + archive source in one transaction
// ════════════════════════════════════════════════════════════════════════════════
router.post("/api/tasks/send-to-pub", requireAuth, async (req, res) => {
  const { sourceId, pubTask } = req.body;
  if (!sourceId || !pubTask) return res.status(400).json({ error: "sourceId and pubTask required" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 1. Create pub task
    const { id, type, title, project_id, status, data } = pubTask;
    await client.query(
      "INSERT INTO tasks(id,type,title,project_id,status,data,archived,completed_at,starred) VALUES($1,$2,$3,$4,$5,$6,false,'',false)",
      [id, "pub", title||"", project_id||"none", status||"draft", JSON.stringify(data||{})]
    );
    // 2. Archive source task
    await client.query("UPDATE tasks SET archived=true, completed_at=$1 WHERE id=$2", [new Date().toISOString().slice(0,10), sourceId]);
    await client.query("COMMIT");
    res.json({ ok: true, id });
  } catch(e) {
    await client.query("ROLLBACK");
    console.error("send-to-pub error:", e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
