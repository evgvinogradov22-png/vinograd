const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.get("/api/projects", requireAuth, async (req, res) => {
  try { res.json(await q("SELECT * FROM projects ORDER BY created_at")); }
  catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

router.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const { label, color, description, links } = req.body;
    if (!label) return res.status(400).json({ error: "Нужно название" });
    const id = "proj_" + uuidv4().replace(/-/g, "").slice(0, 10);
    await q("INSERT INTO projects(id,label,color,description,links) VALUES($1,$2,$3,$4,$5)",
      [id, label, color || "#8b5cf6", description || "", JSON.stringify(links || [])]);
    res.json(await q1("SELECT * FROM projects WHERE id=$1", [id]));
  } catch(e) { res.status(500).json({ error: "Ошибка" }); }
});

router.patch("/api/projects/:id", requireAuth, async (req, res) => {
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

router.delete("/api/projects/:id", requireAuth, async (req, res) => {
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

module.exports = router;
