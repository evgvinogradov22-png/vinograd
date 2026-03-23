const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/users", requireAuth, async (req, res) => {
  try { res.json(await q("SELECT id,telegram,name,role,color,last_active,avatar_url FROM users ORDER BY created_at")); }
  catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

router.patch("/api/users/:id", requireAuth, async (req, res) => {
  try {
    const { name, role, color, telegram } = req.body;
    await q("UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), color=COALESCE($3,color), telegram=COALESCE($4,telegram) WHERE id=$5",
      [name, role, color, telegram, req.params.id]);
    res.json(await q1("SELECT id,telegram,name,role,color FROM users WHERE id=$1", [req.params.id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

router.delete("/api/users/:id", requireAuth, async (req, res) => {
  try { await q("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ ok: true }); }
  catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
