import express from 'express';
import { createClient } from '@libsql/client';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Turso database
const db = createClient({
  url: process.env.TURSO_URL || 'libsql://budget-evgvinogradov22-png.aws-eu-west-1.turso.io',
  authToken: process.env.TURSO_TOKEN || ''
});

// Create table
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS data (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Database initialized');
}
initDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// API Routes
app.get('/api/data/:key', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT value FROM data WHERE key = ?',
      args: [req.params.key]
    });
    if (result.rows.length > 0) {
      res.json({ key: req.params.key, value: result.rows[0].value });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/data/:key', async (req, res) => {
  try {
    const { value } = req.body;
    await db.execute({
      sql: `INSERT INTO data (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      args: [req.params.key, value, value]
    });
    res.json({ success: true, key: req.params.key });
  } catch (error) {
    console.error('POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/data/:key', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM data WHERE key = ?',
      args: [req.params.key]
    });
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'turso' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
