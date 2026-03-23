const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/notifications", requireAuth, async (req, res) => {
  const uid = req.headers["x-user-id"];
  if (!uid) return res.json([]);
  try {
    const rows = await q("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [uid]);
    console.log("[NOTIF GET] user:", uid, "count:", rows.length);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// POST /api/notifications/read — отметить прочитанным
router.post("/api/notifications/read", requireAuth, async (req, res) => {
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

module.exports = router;
