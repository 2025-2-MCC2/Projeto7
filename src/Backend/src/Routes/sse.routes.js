// src/Backend/src/routes/sse.routes.js
import { Router } from "express";
import { sseGroupHandler, sseGlobalHandler } from "../services/sse.js";

const router = Router();
router.get("/stream/grupos/:grupoId", sseGroupHandler);
router.get("/stream/global",          sseGlobalHandler);

export default router;