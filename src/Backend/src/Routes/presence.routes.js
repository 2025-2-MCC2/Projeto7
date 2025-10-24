// src/Backend/src/routes/presence.routes.js
import { Router } from 'express';
import { heartbeat, getPresence } from '../controllers/presenceController.js';

const router = Router();

router.post('/heartbeat', heartbeat);
router.get('/:id', getPresence);

export default router;