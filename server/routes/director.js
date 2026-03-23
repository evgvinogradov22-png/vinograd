const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

// DIRECTOR PANEL API
// ════════════════════════════════════════════════════════════════════════════════

// List all files in R2
router.get("/api/director/files", requireAuth, async (req, res) => {
  try {
    const cmd = new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: "vinogradov/", MaxKeys: 1000 });
    const data = await r2.send(cmd);
    const files = (data.Contents || []).map(f => ({
      key: f.Key,
      name: f.Key.split("/").pop(),
      size: f.Size,
      lastModified: f.LastModified,
      url: `${R2_PUBLIC_URL}/${f.Key}`,
    }));
    res.json(files);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete file from R2
router.delete("/api/director/files", requireAuth, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get activity logs (chat messages from all tasks, joined with task info)
router.get("/api/director/logs", requireAuth, async (req, res) => {
  try {
    const rows = await pool.query(`
      SELECT 
        cm.id, cm.task_id, cm.user_id, cm.text, cm.file_name, cm.file_url, cm.created_at,
        u.name as user_name, u.role as user_role
      FROM chat_messages cm
      LEFT JOIN users u ON u.id::text = cm.user_id::text
      ORDER BY cm.created_at DESC
      LIMIT 500
    `);
    res.json(rows.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
