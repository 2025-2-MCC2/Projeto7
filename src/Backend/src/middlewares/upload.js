// src/Backend/src/middlewares/upload.js
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { extension as mimeExt } from 'mime-types';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function pickSafeExt(file) {
  // Extensão do nome original (sem ponto), ex.: 'jpg', 'jpeg', 'png', ...
  const orig = (path.extname(file.originalname || '').toLowerCase() || '').replace('.', '');

  // Ext do mimetype: 'jpeg', 'png', 'gif', 'webp', ...
  const fromMime = (mimeExt(file.mimetype) || '').toLowerCase();

  // Mapas de normalização
  const allow = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
  const mapMimeToDefault = {
    'image/jpeg': 'jpg',     // preferir .jpg por compat
    'image/jpg' : 'jpg',
    'image/png' : 'png',
    'image/gif' : 'gif',
    'image/webp': 'webp',
  };

  // 1) Se a extensão original for válida, preserve-a (.jpg vs .jpeg)
  if (allow.has(orig)) return orig;

  // 2) Caso contrário, usa um default baseado no mimetype
  const viaMime = mapMimeToDefault[file.mimetype];
  if (viaMime) return viaMime;

  // 3) Último fallback: a extensão a partir do mimetype
  if (allow.has(fromMime)) return fromMime;

  // 4) Fallback hard (não esperado para imagens aceitas)
  return 'bin';
}

export function makeProfileUpload() {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const userId = String(req.body.userId || 'anonymous');
        const base = path.resolve(process.cwd(), 'uploads', 'profile', userId);
        ensureDir(base);
        cb(null, base);
      } catch (e) {
        cb(e);
      }
    },
    filename: (_req, file, cb) => {
      const ext = pickSafeExt(file);
      const fname = `${Date.now()}.${ext}`;
      cb(null, fname);
    },
  });

  // Limite de 8MB; aceita jpg/jpeg/png/gif/webp
  const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ].includes(file.mimetype);
      if (ok) return cb(null, true);
      cb(new Error('Tipo de arquivo não suportado (use JPG, PNG, GIF, WEBP).'));
    },
  });

  return upload.single('photo'); // campo form-data: "photo"
}