import app from '../src/app.js';
import { initDatabase } from '../src/config/database.js';

let isDbInitialized = false;

export default async function handler(req, res) {
  if (!isDbInitialized) {
    try {
      await initDatabase();
      isDbInitialized = true;
    } catch (err) {
      console.error('❌ Erro ao inicializar banco de dados no Vercel Handler:', err);
    }
  }
  return app(req, res);
}
