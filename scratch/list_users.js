import { initDatabase, db } from '../src/config/database.js';

async function listUsers() {
  await initDatabase();
  const users = db.prepare('SELECT id, nome, email, matricula, grupo, perfil FROM usuarios ORDER BY CAST(matricula AS INTEGER) ASC').all();
  console.log(users);
  process.exit(0);
}

listUsers();
