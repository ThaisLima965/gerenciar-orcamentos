import { Router } from 'express';
import { neonSyncService } from '../services/neonSyncService.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Rota leve de checagem de integridade e versão em tempo real (Polling / SWR)
// Revalida automaticamente se novos dados surgiram no Neon
router.get('/status', async (req, res) => {
  try {
    const status = await neonSyncService.getNeonStatus();
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao consultar status de sincronização.'
    });
  }
});

// Sincronização forçada em segundo plano (Downstream: Neon -> SQLite)
router.post('/pull', authenticate, async (req, res) => {
  try {
    const result = await neonSyncService.syncFromNeon(true);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao puxar dados do Neon.'
    });
  }
});

export default router;
