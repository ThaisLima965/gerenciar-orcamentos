import bcrypt from 'bcryptjs';
import { initDatabase, db } from '../src/config/database.js';

async function testAuth() {
  await initDatabase();
  const user = db.prepare('SELECT id, nome, email, matricula, senha_hash, perfil, grupo, ativo FROM usuarios WHERE email = ?').get('thais.lima@tkelevator.com');
  console.log('User from DB:', user);
  const passOk = bcrypt.compareSync('Senha@12345', user.senha_hash);
  console.log('Password comparison with Senha@12345:', passOk);
  process.exit(0);
}

testAuth();
