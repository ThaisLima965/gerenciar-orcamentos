import { Router } from 'express';
import { usuarioController } from '../controllers/usuarioController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { uploadSpreadsheet } from '../middleware/upload.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('CONSULTORA'));

// Listar e criar usuários (Exclusivo Consultora)
router.get('/', usuarioController.list);
router.post('/', usuarioController.create);

// Baixar modelo de planilha de usuários (.xlsx / .csv)
router.get('/template', usuarioController.downloadTemplate);

// Importar planilha de usuários (.xlsx / .csv) em lote
router.post('/import', uploadSpreadsheet.single('file'), usuarioController.importarPlanilha);

// Resetar senha para provisória, alternar status, alterar grupo, alterar dados e excluir usuário (Exclusivo Consultora)
router.put('/:id', usuarioController.update);
router.patch('/:id/grupo', usuarioController.updateGrupo);
router.patch('/:id/reset-password', usuarioController.resetPassword);
router.patch('/:id/toggle-status', usuarioController.toggleStatus);
router.delete('/:id', usuarioController.delete);

export default router;
