// routes/auth.routes.js
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, refresh, logout, requestPasswordReset,resetPassword, } from "../controllers/authController.js";

const router = Router();

const limiterLogin = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20,                  // 20 tentativas por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." },
});

const limiterRefresh = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/auth/login", limiterLogin, login);
router.post("/auth/refresh", limiterRefresh, refresh);
router.post("/auth/logout", logout);
router.post('/auth/request-reset', requestPasswordReset);
router.post('/auth/reset-password', resetPassword);

export default router;