const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

function requireAuth(req, res, next) {
  const auth = req.headers["authorization"];
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-token"];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      req.userTelegram = decoded.telegram;
    } catch(e) {}
  }
  if (!req.userId) req.userId = req.headers["x-user-id"] || null;
  if (!req.userId) return res.status(401).json({ error: "Не авторизован" });
  next();
}

module.exports = { requireAuth };
