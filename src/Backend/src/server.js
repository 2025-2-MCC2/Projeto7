// src/Backend/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { initDb } from './DataBase/db.js';
import authRoutes from './routes/auth.routes.js';
import usuarioRoutes from './routes/user.routes.js';

const app = express();

const ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:5173';
const PORT = process.env.PORT || 3000;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Rotas
app.use('/api', authRoutes);
app.use('/api/usuario', usuarioRoutes);

// Healthcheck
app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }))

// Inicializa DB e só então sobe o servidor
await initDb();

app.listen(PORT, () => {
  console.log(`✅ API ON em http://localhost:${PORT}`);
  console.log(`   CORS origin: ${ORIGIN}`);
});