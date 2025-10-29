// src/Backend/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { initDb } from './DataBase/db.js';

// Rotas principais
import profileRoutes from './routes/profile.routes.js';
import presenceRoutes from './routes/presence.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import authRoutes from './routes/auth.routes.js';
import usuarioRoutes from './routes/user.routes.js';
import sseRoutes from './routes/sse.routes.js';
import mainRoutes from './Routes/routes.js';

// 🔒 Middleware de autenticação (seu middleware original)
import { requireAuth } from './middlewares/requireAuth.js';

const app = express();

const ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;

// Segurança e middlewares básicos
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ===== Rotas públicas =====
app.use('/api', authRoutes);                // Login / Registro
app.use('/api/usuario', usuarioRoutes);     // Usuários
app.use('/api/profile', profileRoutes);     // Perfis
app.use('/api', dashboardRoutes);           // Painel
app.use('/api', sseRoutes);                 // SSE (notificações)

// ===== Rotas protegidas =====
// Tudo que requer autenticação vem abaixo
app.use('/api/presence', requireAuth, presenceRoutes); // Presença protegida
app.use('/api', requireAuth, mainRoutes);               // Grupos / Doações / Metas / etc.

// ===== Health check =====
app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }));

// ===== Servir uploads estáticos =====
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  etag: true,
}));

// ===== Middleware global de erro =====
app.use((err, req, res, next) => {
  console.error('❌ Erro interno:', err);
  res.status(500).json({ error: 'Erro interno no servidor', detalhe: err?.message });
});

// ===== Inicializa o banco e inicia o servidor =====
await initDb();

app.listen(PORT, () => {
  console.log(`✅ API ON em http://localhost:${PORT}`);
  console.log(`   CORS origin: ${ORIGIN}`);
});
