// src/Backend/src/routes/dashboard.routes.js
import { Router } from "express";
import { getSummary, getInventory, getTimeseries } from "../controllers/dashboardController.js";

const router = Router();

router.get("/dashboard/:grupoId/summary", getSummary);
router.get("/dashboard/:grupoId/inventory", getInventory);
router.get("/dashboard/:grupoId/timeseries", getTimeseries);

export default router;  