import { Router } from 'express';
import { orcamentoController } from '../controllers/orcamentoController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Todas as rotas de orçamentos exigem autenticação prévia
router.use(authenticate);

// Listar chamados / orçamentos (Todos os perfis)
router.get('/', orcamentoController.list);

// Obter detalhes de um chamado específico
router.get('/:id', orcamentoController.getById);

// Criar novo chamado (Todos os perfis autenticados podem abrir chamado)
router.post('/', orcamentoController.create);

// Atualizar chamado (Permissões de campo validadas pelo controller de acordo com o perfil)
router.put('/:id', orcamentoController.update);
router.patch('/:id', orcamentoController.update);

// Excluir chamado (Apenas CONSULTORA)
router.delete('/:id', requireRole('CONSULTORA'), orcamentoController.delete);

export default router;
