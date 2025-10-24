// src/Backend/src/controllers/profileController.js
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../DataBase/db.js';
import { fileTypeFromFile } from 'file-type'; // ✅ NOVO

function publicFileUrl(userId, filename, req) {
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/profile/${encodeURIComponent(userId)}/${encodeURIComponent(filename)}`;
}

export async function uploadPhoto(req, res) {
  const pool = getDb();

  try {
    const userId = String(req.body.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });
    if (!req.file) return res.status(400).json({ error: 'Arquivo ausente (campo "photo").' });

    // Caminho/arquivo que o multer salvou
    const savedPath = req.file.path;            // ex.: uploads/profile/<userId>/<timestamp>.png
    let filename   = req.file.filename;         // ex.: <timestamp>.png
    const dir      = path.dirname(savedPath);

    // ✅ NOVO: sniff do arquivo (bytes reais)
    const ft = await fileTypeFromFile(savedPath);
    if (!ft || !['jpg','jpeg','png','gif','webp'].includes(ft.ext)) {
      // não é imagem válida suportada
      // (Opcional: remover arquivo salvo)
      try { await fs.promises.unlink(savedPath); } catch {}
      return res.status(415).json({ error: 'Tipo de arquivo não suportado (use JPG, PNG, GIF, WEBP).' });
    }

    // Normaliza jpeg -> jpg
    const actualExt = ft.ext === 'jpeg' ? 'jpg' : ft.ext;
    const currentExt = path.extname(filename).slice(1).toLowerCase();

    // Se a extensão do arquivo salvo não bate com a real, renomeia
    if (actualExt !== currentExt) {
      const baseName = path.basename(filename, path.extname(filename)); // <timestamp>
      const newName  = `${baseName}.${actualExt}`;
      const newPath  = path.join(dir, newName);

      await fs.promises.rename(savedPath, newPath);
      filename = newName;
    }

    const url = publicFileUrl(userId, filename, req);

    // Atualiza usuario.foto_url
    await pool.query(
      'UPDATE usuario SET foto_url = ? WHERE (email = ? OR RA = ? OR ID_usuario = ?)',
      [url, userId, userId, Number.isNaN(+userId) ? null : +userId]
    );

    return res.status(201).json({ url });
  } catch (e) {
    console.error('profile.uploadPhoto error:', e);
    return res.status(500).json({ error: 'Erro ao enviar foto' });
  }
}

export async function linkPhoto(req, res) {
  const pool = getDb();

  try {
    const { userId, url } = req.body || {};
    if (!userId || !url) return res.status(400).json({ error: 'userId e url são obrigatórios.' });
    try {
      const u = new URL(url);
      if (!/^https?:$/i.test(u.protocol)) throw new Error('URL deve ser http(s).');
    } catch {
      return res.status(400).json({ error: 'URL inválida.' });
    }
    await pool.query(
      'UPDATE usuario SET foto_url = ? WHERE (email = ? OR RA = ? OR ID_usuario = ?)',
      [url, userId, userId, Number.isNaN(+userId) ? null : +userId]
    );
    return res.json({ url });
  } catch (e) {
    console.error('profile.linkPhoto error:', e);
    return res.status(500).json({ error: 'Erro ao vincular URL de foto' });
  }
}

export async function removePhoto(req, res) {
  const pool = getDb();

  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });

    await pool.query(
      'UPDATE usuario SET foto_url = NULL WHERE (email = ? OR RA = ? OR ID_usuario = ?)',
      [userId, userId, Number.isNaN(+userId) ? null : +userId]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('profile.removePhoto error:', e);
    return res.status(500).json({ error: 'Erro ao remover foto' });
  }
}