/*
  Este NOVO ficheiro de rotas define os endpoints
  que o frontend (Relatorios.jsx) irá consumir.
*/
import { Router } from 'express';
import {
  getRelatorios,
  createRelatorio,
  updateRelatorio,
  updateStatus,
  exportPdf
} from '../controllers/relatorioMensalController.js';
// TODO: Adicionar 'requireAuth' e 'requireMentor' middlewares
// import { requireAuth } from '../middlewares/requireAuth.js';
// import { requireMentor } from '../middlewares/requireMentor.js';

const router = Router();

// Rota de exportação (deve vir antes de /:id para evitar conflito)
router.get('/relatorios-mensais/export/pdf', exportPdf);

// Rotas de dados
router.get('/relatorios-mensais', getRelatorios);
router.post('/relatorios-mensais', createRelatorio);
router.put('/relatorios-mensais/:id', updateRelatorio);
router.put('/relatorios-mensais/:id/status', updateStatus); // Rota do Mentor

export default router;
