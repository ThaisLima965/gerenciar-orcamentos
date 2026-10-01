import { Router } from 'express';
import { relatorioController } from '../controllers/relatorioController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Todas as rotas de relatórios exigem autenticação prévia
router.use(authenticate);

// Obter dados consolidados do Dashboard e Apuração para Premiação
router.get('/premiacao', relatorioController.getDashboardPremiacao);

// Exportar planilha formatada em Excel (.xlsx) (Exclusivo Consultora)
router.get('/premiacao/export', requireRole('CONSULTORA'), relatorioController.exportExcelPremiacao);

export default router;
