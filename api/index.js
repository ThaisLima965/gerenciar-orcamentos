import app from '../src/app.js';
import { initDatabase } from '../src/config/database.js';

let dbInitPromise = null;

export default async function handler(req, res) {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().catch((err) => {
      console.error('❌ [Vercel] Falha na inicialização do banco de dados:', err);
      dbInitPromise = null;
      throw err;
    });
  }

  try {
    await dbInitPromise;
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Falha ao inicializar o banco de dados: ${err.message}`
    });
  }

  return app(req, res);
}
