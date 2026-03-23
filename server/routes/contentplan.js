const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

// CONTENT PLAN API
// ════════════════════════════════════════════════════════════════════════════════

// Ensure table exists
async function ensureContentPlanTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_plan (
      id TEXT PRIMARY KEY,
      proj_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      days JSONB NOT NULL DEFAULT '{}',
      sort_order INTEGER DEFAULT 0,
      created_at BIGINT DEFAULT 0
    )
  `);
}
ensureContentPlanTable().catch(e => console.warn("content_plan table:", e.message));

// One-time cleanup: fix corrupted file_url values like "м=https://..." in chat_messages and tasks
async function cleanCorruptedUrls() {
  try {
    // Fix chat_messages with м= prefix
    await pool.query(
      "UPDATE chat_messages SET file_url = REGEXP_REPLACE(file_url, '^.*?(https://)', '\\1') WHERE file_url LIKE '%=%https://%' OR file_url LIKE '%м=%' OR file_url LIKE '%=%http%'"
    );
    // Fix tasks data JSON field — file_url and final_file_url inside data jsonb
    const tasks = await pool.query("SELECT id, data FROM tasks WHERE data::text LIKE '%м=%' OR data::text LIKE '%=%https://%'");
    for (const row of tasks.rows) {
      const data = row.data || {};
      let changed = false;
      for (const field of ['file_url','final_file_url','source_url']) {
        if (data[field] && (data[field].includes('м=') || data[field].match(/=https?:\/\//))) {
          const parts = data[field].split('https://');
          if (parts.length > 1) { data[field] = 'https://' + parts[parts.length-1]; changed = true; }
        }
      }
      if (data.sources && Array.isArray(data.sources)) {
        data.sources = data.sources.map(s => {
          if (s.url && (s.url.includes('м=') || s.url.match(/=https?:\/\//))) {
            const parts = s.url.split('https://');
            if (parts.length > 1) { changed = true; return {...s, url: 'https://' + parts[parts.length-1]}; }
          }
          return s;
        });
      }
      if (changed) {
        await pool.query("UPDATE tasks SET data=$1 WHERE id=$2", [JSON.stringify(data), row.id]);
      }
    }
    console.log("✅ URL cleanup done");
  } catch(e) { console.warn("URL cleanup error:", e.message); }
}
cleanCorruptedUrls();

// GET all rows for a month
router.get("/api/content-plan", requireAuth, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: "year and month required" });
  try {
    const rows = await pool.query(
      "SELECT * FROM content_plan WHERE year=$1 AND month=$2 ORDER BY proj_id, sort_order, created_at",
      [parseInt(year), parseInt(month)]
    );
    res.json(rows.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST create row
router.post("/api/content-plan", requireAuth, async (req, res) => {
  const { id, proj_id, year, month, type, days, sort_order } = req.body;
  if (!id || !proj_id) return res.status(400).json({ error: "id and proj_id required" });
  try {
    await pool.query(
      "INSERT INTO content_plan(id,proj_id,year,month,type,days,sort_order,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET type=EXCLUDED.type, days=EXCLUDED.days, sort_order=EXCLUDED.sort_order",
      [id, proj_id, parseInt(year), parseInt(month), type||"", JSON.stringify(days||{}), sort_order||0, Date.now()]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH update row (type or days)
router.patch("/api/content-plan/:id", requireAuth, async (req, res) => {
  const { type, days } = req.body;
  try {
    if (type !== undefined) await pool.query("UPDATE content_plan SET type=$1 WHERE id=$2", [type, req.params.id]);
    if (days !== undefined) await pool.query("UPDATE content_plan SET days=$1 WHERE id=$2", [JSON.stringify(days), req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE row
router.delete("/api/content-plan/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM content_plan WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
