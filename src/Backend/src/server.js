import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import { initDb } from "./DataBase/db.js";

// ===== Rotas =====
import profileRoutes from "./Routes/profile.routes.js";
import presenceRoutes from "./Routes/presence.routes.js";
import dashboardRoutes from "./Routes/dashboard.routes.js";
import authRoutes from "./Routes/auth.routes.js";
import usuarioRoutes from "./Routes/user.routes.js";
import sseRoutes from "./Routes/sse.routes.js";
import mainRoutes from "./Routes/routes.js";
import relatorioMensalRoutes from "./Routes/relatorioMensal.routes.js";
import { requireAuth } from "./middlewares/requireAuth.js";

// =================================================================
// 1. INICIALIZAÇÃO DO APP
// =================================================================
const app = express();

// =================================================================
// 2. CONSTANTES DE AMBIENTE
// (Definir ANTES de usá-las)
// =================================================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

console.log('--- Configuração do Servidor ---');
console.log(`[ENV] Ambiente: ${NODE_ENV} (isProd: ${isProd})`);

// =================================================================
// 3. CONFIGURAÇÃO DE COOKIE
// (Precisa de `isProd` definido acima)
// =================================================================
export const cookieBase = {
  httpOnly: true,
  secure: true, // (Produção: true) Requer HTTPS
  sameSite: isProd ? 'none' : 'lax', // (Produção: 'none') Para cross-origin
  path: '/',
  // Lembrete: maxAge (duração) é definido no auth.controller.js
};
console.log(`[COOKIE] Config: Secure=${cookieBase.secure}, SameSite=${cookieBase.sameSite}`);

// =================================================================
// 4. MIDDLEWARES GLOBAIS
// =================================================================

// --- CORS ---
// Suporte a múltiplas origens (ex: "url1.com,url2.com")
const allowedOrigins = CORS_ORIGIN.split(",").map((o) =>
  o.trim().replace(/\/$/, "") // remove barra final
);
console.log(`[CORS] Liberado para: ${allowedOrigins.join(", ")}`);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite !origin (ex: Postman) ou origens na lista
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Origem REJEITADA: ${origin}`);
        callback(new Error(`Origem ${origin} não permitida pelo CORS`));
      }
    },
    credentials: true, // Essencial para cookies
  })
);

// --- Segurança e Parsers ---
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false, // Ajuste conforme necessário
}));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// =================================================================
// 5. ROTAS
// =================================================================

// --- Rotas Públicas ---
app.use("/api", authRoutes); // Login / Logout / Refresh
app.use("/api/usuario", usuarioRoutes); // Criar usuário
app.get(["/health", "/api/health"], (_req, res) => res.json({ ok: true }));

// --- Rotas Protegidas (Requerem autenticação) ---
// (O middleware requireAuth vai barrar se não houver cookie JWT válido)
app.use("/api/profile", requireAuth, profileRoutes);
app.use("/api/presence", requireAuth, presenceRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/sse", requireAuth, sseRoutes);
app.use("/api/relatorio", requireAuth, relatorioMensalRoutes);
app.use("/api", requireAuth, mainRoutes); // Rotas principais (grupos, etc.)

// --- Servir uploads estáticos ---
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: "7d", // Cache de 7 dias
    etag: true,
  })
);

// =================================================================
// 6. HANDLER DE ERRO GLOBAL
// =================================================================
app.use((err, req, res, next) => {
  console.error("❌ Erro Interno (Global):", err);
  res
    .status(500)
    .json({ error: "Erro interno no servidor", detalhe: err?.message });
});

// =================================================================
// 7. INICIALIZAÇÃO
// =================================================================
(async () => {
  try {
    await initDb();
    console.log('---');
    app.listen(PORT, () => {
      console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (dbError) {
    console.error("❌ Falha ao inicializar o banco de dados:", dbError);
    process.exit(1); // Falha em iniciar se o banco não conectar
  }
})();