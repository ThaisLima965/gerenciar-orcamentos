import { Router } from 'express';
import { clienteController } from '../controllers/clienteController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadSpreadsheet } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

// Listar clientes (Todos os perfis autenticados)
router.get('/', clienteController.list);

// Baixar modelo de planilha (.xlsx / .csv) (Consultora e Supervisor)
router.get('/template', requireRole('CONSULTORA', 'SUPERVISOR'), clienteController.downloadTemplate);

// Cadastrar novo cliente individual (Consultora e Supervisor)
router.post('/', requireRole('CONSULTORA', 'SUPERVISOR'), clienteController.create);

// Alterar cadastro de cliente (Exclusivo Consultora)
router.put('/:numero_contrato', requireRole('CONSULTORA'), clienteController.update);

// Excluir cliente (Exclusivo Consultora)
router.delete('/:numero_contrato', requireRole('CONSULTORA'), clienteController.delete);

// Importar planilha (.xlsx / .csv) em lote (Consultora e Supervisor)
router.post('/import', requireRole('CONSULTORA', 'SUPERVISOR'), uploadSpreadsheet.single('file'), clienteController.importarPlanilha);

export default router;
