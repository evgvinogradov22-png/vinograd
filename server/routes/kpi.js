const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/analytics/kpi", async (req, res) => {
  try {
    const rows = await q("SELECT * FROM analytics_kpi");
    res.json(rows);
  } catch(e) { res.json([]); }
});

router.post("/api/analytics/kpi", async (req, res) => {
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

module.exports = router;
