const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/training", async (req, res) => {
  try { res.json(await q("SELECT * FROM training ORDER BY created_at DESC")); }
  catch(e) { res.json([]); }
});

router.post("/api/training", async (req, res) => {
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

router.delete("/api/training/:id", async (req, res) => {
  try {
    await q("DELETE FROM training WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// USERS (team)
// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
