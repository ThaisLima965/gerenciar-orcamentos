import { initDatabase, saveDatabase, db } from '../src/config/database.js';
import { neonSyncService } from '../src/services/neonSyncService.js';
import dotenv from 'dotenv';

dotenv.config();

async function pullFromNeon() {
  console.log('⬇️ [Pull Neon] Baixando dados mais recentes do Neon PostgreSQL para o SQLite local...');

  if (!neonSyncService.isConfigured) {
    console.error('❌ DATABASE_URL não configurada no .env');
    process.exit(1);
  }

  await initDatabase();
  const result = await neonSyncService.syncFromNeon(true);

  if (result.success) {
    saveDatabase();
    const orcCount = db.prepare('SELECT COUNT(*) as c FROM chamados_orcamentos').get()?.c || 0;
    const usrCount = db.prepare('SELECT COUNT(*) as c FROM usuarios').get()?.c || 0;
    const tecCount = db.prepare('SELECT COUNT(*) as c FROM tecnicos').get()?.c || 0;
    const cliCount = db.prepare('SELECT COUNT(*) as c FROM clientes').get()?.c || 0;
    console.log(`✅ [Pull Neon] Dados de produção copiados com sucesso para o banco local!`);
    console.log(`📊 Total local: ${usrCount} usuários, ${tecCount} técnicos, ${cliCount} clientes, ${orcCount} orçamentos.`);
  } else {
    console.error('❌ [Pull Neon] Falha ao sincronizar dados do Neon:', result.error);
    process.exit(1);
  }
}

pullFromNeon().catch((err) => {
  console.error('❌ Erro no pull do Neon:', err);
  process.exit(1);
});
