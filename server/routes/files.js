const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { pool, q, q1 } = require("../db");
const { requireAuth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, INVITE_PASSWORD } = require("../config");

router.post("/api/presign-upload", requireAuth, async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const origName = name;
    let contentType = type || "application/octet-stream";
    // Fix audio/webm for voice messages
    if (origName.startsWith("voice_") && contentType === "video/webm") contentType = "audio/webm";
    const safeKey = `vinogradov/${Date.now()}_${origName.replace(/[^\w.\-а-яёА-ЯЁ]/gi, "_")}`;
    const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: safeKey, ContentType: contentType });
    const presignedUrl = await getSignedUrl(r2, cmd, { expiresIn: 3600 });
    const publicUrl = `${R2_PUBLIC_URL}/${safeKey}`;
    res.json({ presignedUrl, url: publicUrl, key: safeKey });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD → R2 (fallback proxy — used for voice blobs that can't use presigned)
// ════════════════════════════════════════════════════════════════════════════════

router.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Нет файла" });
    const origName = req.file.originalname;
    // Keep original filename in key (only replace truly unsafe chars)
    const safeKey = `vinogradov/${Date.now()}_${origName.replace(/[^\w.\-а-яёА-ЯЁ]/gi, "_")}`;
    // Fix content type for voice messages — multer may detect audio as video/webm
    let contentType = req.file.mimetype;
    if (origName.startsWith("voice_")) {
      // Always treat voice_ files as audio regardless of what multer detected
      if (!contentType.startsWith("audio/")) {
        contentType = origName.endsWith(".ogg") ? "audio/ogg" : origName.endsWith(".mp4") ? "audio/mp4" : "audio/webm";
      }
    }
    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         safeKey,
      Body:        req.file.buffer,
      ContentType: contentType,
    }));
    const url = `${R2_PUBLIC_URL}/${safeKey}`;
    res.json({ url, key: safeKey, name: origName, size: req.file.size });
  } catch(e) { console.error(e); res.status(500).json({ error: "Ошибка загрузки: " + e.message }); }
});

// Download URL — returns presigned URL as JSON so client can download directly (no Railway bottleneck)
router.get("/api/download-url", async (req, res) => {
  const { key, name } = req.query;
  if (!key) return res.status(400).json({ error: "key required" });
  try {
    const fname = name || key.split("/").pop() || "file";
    const isAudio = /voice_|\.(webm|ogg|mp3|m4a|wav)$/i.test(fname);
    const cmd = new GetObjectCommand({
      Bucket: R2_BUCKET, Key: key,
      ResponseContentDisposition: isAudio
        ? `inline; filename*=UTF-8''${encodeURIComponent(fname)}`
        : `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    });
    const url = await getSignedUrl(r2, cmd, { expiresIn: 3600 });
    res.json({ url });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Download — proxy file from R2 with proper headers (works in all browsers including Yandex)
router.get("/api/download", async (req, res) => {
  const { key, name } = req.query;
  if (!key) return res.status(400).send("key required");
  try {
    const fname = name || key.split("/").pop() || "file";
    const isAudio = /voice_|\.(webm|ogg|mp3|m4a|wav)$/i.test(fname);
    const ext = fname.split(".").pop().toLowerCase();
    const mimeMap = { mp4:"video/mp4", mov:"video/quicktime", avi:"video/x-msvideo", mkv:"video/x-matroska", webm: isAudio?"audio/webm":"video/webm", ogg:"audio/ogg", mp3:"audio/mpeg", m4a:"audio/mp4", wav:"audio/wav", jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", pdf:"application/pdf" };
    const mime = mimeMap[ext] || "application/octet-stream";
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", isAudio
      ? `inline; filename*=UTF-8''${encodeURIComponent(fname)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`);
    if (obj.ContentLength) res.setHeader("Content-Length", obj.ContentLength);
    res.setHeader("Cache-Control", "private, max-age=3600");
    obj.Body.pipe(res);
  } catch(e) {
    console.error("Download error:", e);
    res.status(500).send("Ошибка: " + e.message);
  }
});

// ════════════════════════════════════════════════════════════════════════════════

module.exports = router;
