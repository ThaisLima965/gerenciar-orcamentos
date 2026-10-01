import { Router } from 'express';
import { clienteController } from '../controllers/clienteController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadSpreadsheet } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);

// Listar clientes (Todos os perfis autenticados)
router.get('/', clienteController.list);

// Baixar modelo de planilha (.xlsx / .csv) (Exclusivo Consultora)
router.get('/template', requireRole('CONSULTORA'), clienteController.downloadTemplate);

// Cadastrar novo cliente individual (Exclusivo Consultora)
router.post('/', requireRole('CONSULTORA'), clienteController.create);

// Alterar cadastro de cliente (Exclusivo Consultora)
router.put('/:numero_contrato', requireRole('CONSULTORA'), clienteController.update);

// Excluir cliente (Exclusivo Consultora)
router.delete('/:numero_contrato', requireRole('CONSULTORA'), clienteController.delete);

// Importar planilha (.xlsx / .csv) em lote (Exclusivo Consultora)
router.post('/import', requireRole('CONSULTORA'), uploadSpreadsheet.single('file'), clienteController.importarPlanilha);

export default router;
