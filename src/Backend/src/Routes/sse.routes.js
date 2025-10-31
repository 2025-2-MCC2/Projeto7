// src/Backend/src/routes/sse.routes.js
import { Router } from "express";
import { sseGroupHandler, sseGlobalHandler } from "../services/sse.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/stream/grupos/:grupoId", requireAuth, sseGroupHandler);
router.get("/stream/global", requireAuth, sseGlobalHandler);

export default router;
