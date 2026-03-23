const JWT_SECRET = process.env.JWT_SECRET || "vg_secret_2026_change_in_production";
const INVITE_PASSWORD = process.env.INVITE_PASSWORD || "vinograd2026";
const R2_BUCKET = process.env.R2_BUCKET || "contentflow-files";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
const PORT = process.env.PORT || 3001;

module.exports = { JWT_SECRET, INVITE_PASSWORD, R2_BUCKET, R2_PUBLIC_URL, PORT };
