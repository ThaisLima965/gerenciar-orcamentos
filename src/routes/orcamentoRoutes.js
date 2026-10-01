import { Router } from 'express';
import { orcamentoController } from '../controllers/orcamentoController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadSpreadsheet } from '../middleware/upload.js';

const router = Router();

// Todas as rotas de orçamentos exigem autenticação prévia
router.use(authenticate);

// Listar chamados / orçamentos (Todos os perfis)
router.get('/', orcamentoController.list);

// Baixar modelo de planilha de orçamentos (.xlsx / .csv) (Exclusivo Consultora)
router.get('/template', requireRole('CONSULTORA'), orcamentoController.downloadTemplate);

// Importar planilha (.xlsx / .csv) de orçamentos (Exclusivo Consultora)
router.post('/import', requireRole('CONSULTORA'), uploadSpreadsheet.single('file'), orcamentoController.importarPlanilha);

// Obter detalhes de um chamado específico
router.get('/:id', orcamentoController.getById);

// Criar novo chamado (Exclusivo Consultora e Supervisor - Técnico é somente leitura)
router.post('/', requireRole('CONSULTORA', 'SUPERVISOR'), orcamentoController.create);

// Atualizar chamado (Exclusivo Consultora e Supervisor - Técnico é somente leitura)
router.put('/:id', requireRole('CONSULTORA', 'SUPERVISOR'), orcamentoController.update);
router.patch('/:id', requireRole('CONSULTORA', 'SUPERVISOR'), orcamentoController.update);

// Excluir chamado (Apenas CONSULTORA)
router.delete('/:id', requireRole('CONSULTORA'), orcamentoController.delete);

export default router;
