const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/chat/:taskId", requireAuth, async (req, res) => {
  try {
    res.json(await q("SELECT * FROM chat_messages WHERE task_id=$1 ORDER BY created_at LIMIT 200", [req.params.taskId]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

router.post("/api/chat/:taskId", requireAuth, async (req, res) => {
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
// PRESIGNED UPLOAD URL — client uploads directly to R2, bypassing server
// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
