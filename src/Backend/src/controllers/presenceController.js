// src/Backend/src/controllers/presenceController.js
import { getDb } from '../DataBase/db.js';

export async function heartbeat(req, res) {
  const pool = getDb();
  try {
    const { userId, status } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });

    const safeStatus = ['online', 'ausente', 'offline'].includes(status) ? status : 'online';

    await pool.query(
      `INSERT INTO user_presence (user_id, status, last_seen)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), last_seen = NOW()`,
      [String(userId), safeStatus]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('presence.heartbeat error:', e);
    return res.status(500).json({ error: 'Erro no heartbeat' });
  }
}

export async function getPresence(req, res) {
  const pool = getDb();
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT user_id, status, last_seen FROM user_presence WHERE user_id = ?', [String(id)]);
    if (!rows.length) {
      return res.json({ userId: id, status: 'offline', lastSeen: null });
    }
    const row = rows[0];
    return res.json({ userId: row.user_id, status: row.status, lastSeen: row.last_seen });
  } catch (e) {
    console.error('presence.getPresence error:', e);
    return res.status(500).json({ error: 'Erro ao obter presença' });
  }
}