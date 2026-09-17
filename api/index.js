import app from '../src/app.js';
import { initDatabase } from '../src/config/database.js';

let dbInitPromise = null;

export default async function handler(req, res) {
  try {
    if (!dbInitPromise) {
      dbInitPromise = initDatabase()
        .then(() => {
          console.log('✅ [Vercel Handler] Banco de dados inicializado e pronto.');
        })
        .catch((err) => {
          console.error('❌ [Vercel Handler] Falha na inicialização do banco de dados:', err);
          dbInitPromise = null; // Permite retentar na próxima requisição
          throw err;
        });
    }
    await dbInitPromise;
  } catch (err) {
    console.error('❌ [Vercel Handler] Erro ao atender requisição:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro na inicialização do banco de dados no servidor: ' + (err.message || String(err))
    });
  }

  return app(req, res);
}
