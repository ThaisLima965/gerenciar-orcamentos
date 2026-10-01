import { Router } from 'express';
import { tecnicoController } from '../controllers/tecnicoController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadSpreadsheet } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

// Listar técnicos (Todos os perfis autenticados)
router.get('/', tecnicoController.list);

// Baixar modelo de planilha (.xlsx / .csv) (Exclusivo Consultora)
router.get('/template', requireRole('CONSULTORA'), tecnicoController.downloadTemplate);

// Cadastrar novo técnico individual (Exclusivo Consultora)
router.post('/', requireRole('CONSULTORA'), tecnicoController.create);

// Alterar cadastro de técnico (Exclusivo Consultora)
router.put('/:matricula', requireRole('CONSULTORA'), tecnicoController.update);

// Excluir técnico (Exclusivo Consultora)
router.delete('/:matricula', requireRole('CONSULTORA'), tecnicoController.delete);

// Importar planilha (.xlsx / .csv) em lote (Exclusivo Consultora)
router.post('/import', requireRole('CONSULTORA'), uploadSpreadsheet.single('file'), tecnicoController.importarPlanilha);

export default router;
