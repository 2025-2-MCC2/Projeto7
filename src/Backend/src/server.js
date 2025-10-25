// src/Backend/src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initDb } from './DataBase/db.js';
import path from 'node:path';

import profileRoutes from './routes/profile.routes.js';
import presenceRoutes from './routes/presence.routes.js';
import dashboardRoutes from "./routes/dashboard.routes.js";;
import authRoutes from './routes/auth.routes.js';
import usuarioRoutes from './routes/user.routes.js';

//Imports para Grupos, Doações, Relatórios
import mainRoutes from './Routes/routes.js';       


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
app.use('/api/profile', profileRoutes);
app.use('/api/presence', presenceRoutes);
app.use("/api", dashboardRoutes);
app.use('/api', mainRoutes);  

// Health check
app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }))


// servir uploads estaticamente
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  etag: true,
}));


// Inicializa DB e só então sobe o servidor
await initDb();

app.listen(PORT, () => {
  console.log(`✅ API ON em http://localhost:${PORT}`);
  console.log(`   CORS origin: ${ORIGIN}`);
});