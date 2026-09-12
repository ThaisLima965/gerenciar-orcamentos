import { Router } from 'express';
import { tecnicoController } from '../controllers/tecnicoController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadSpreadsheet } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

// Listar técnicos (Todos os perfis autenticados)
router.get('/', tecnicoController.list);

// Baixar modelo de planilha (.xlsx / .csv) (Consultora e Supervisor)
router.get('/template', requireRole('CONSULTORA', 'SUPERVISOR'), tecnicoController.downloadTemplate);

// Cadastrar novo técnico individual (Consultora e Supervisor)
router.post('/', requireRole('CONSULTORA', 'SUPERVISOR'), tecnicoController.create);

// Alterar cadastro de técnico (Exclusivo Consultora)
router.put('/:matricula', requireRole('CONSULTORA'), tecnicoController.update);

// Excluir técnico (Exclusivo Consultora)
router.delete('/:matricula', requireRole('CONSULTORA'), tecnicoController.delete);

// Importar planilha (.xlsx / .csv) em lote (Consultora e Supervisor)
router.post('/import', requireRole('CONSULTORA', 'SUPERVISOR'), uploadSpreadsheet.single('file'), tecnicoController.importarPlanilha);

export default router;
