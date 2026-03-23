const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.post("/api/auth/register", async (req, res) => {
  try {
    const { telegram, name, role, color, password, invite_password } = req.body;
    if (!telegram || !password) return res.status(400).json({ error: "Заполните все поля" });
    if (invite_password !== INVITE_PASSWORD) return res.status(403).json({ error: "Неверный код приглашения" });
    const clean = telegram.replace(/^@/, "").toLowerCase().trim();
    if (await q1("SELECT id FROM users WHERE telegram=$1", [clean]))
      return res.status(409).json({ error: "Этот ник уже зарегистрирован" });
    const id = "u_" + uuidv4().replace(/-/g, "").slice(0, 10);
    // Hash password before storing
    const hashed = await bcrypt.hash(password, 10);
    await q("INSERT INTO users(id,telegram,name,role,color,password_hash) VALUES($1,$2,$3,$4,$5,$6)",
      [id, clean, name || clean, role || "Оператор", color || "#8b5cf6", hashed]);
    const token = jwt.sign({ id, telegram: clean }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ id, telegram: clean, name: name || clean, role: role || "Оператор", color: color || "#8b5cf6", token });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка сервера" }); }
});

router.post("/api/auth/login", async (req, res) => {
  try {
    const { telegram, password } = req.body;
    const clean = telegram.replace(/^@/, "").toLowerCase().trim();
    const user = await q1("SELECT * FROM users WHERE telegram=$1 OR telegram=$2", [clean, "@"+clean]);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });
    // Support both hashed and plain-text passwords (migration period)
    let valid = false;
    if (user.password_hash && user.password_hash.startsWith("$2")) {
      valid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Plain text — compare directly, then upgrade to hash
      valid = password === user.password_hash;
      if (valid) {
        const hashed = await bcrypt.hash(password, 10);
        await q("UPDATE users SET password_hash=$1 WHERE id=$2", [hashed, user.id]);
      }
    }
    if (!valid) return res.status(401).json({ error: "Неверный пароль" });
    await q("UPDATE users SET last_active=$1 WHERE id=$2", [Date.now(), user.id]);
    const token = jwt.sign({ id: user.id, telegram: user.telegram }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ id: user.id, telegram: user.telegram, name: user.name, role: user.role, color: user.color, token });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка сервера" }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/notifications — получить непрочитанные для текущего пользователя

module.exports = router;
