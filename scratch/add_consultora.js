import bcrypt from 'bcryptjs';
import { initDatabase, db, saveDatabase } from '../src/config/database.js';

async function addConsultora() {
  await initDatabase();

  const nome = 'Thaís Lima';
  const email = 'thais.lima@tkelevator.com';
  const matricula = 'CONS001';
  const senhaPura = 'Senha@12345';
  const perfil = 'CONSULTORA';
  const grupo = 'G11';
  const primeiroAcesso = 0; // Já configurado com a senha definida pelo usuário
  const ativo = 1;

  const senhaHash = bcrypt.hashSync(senhaPura, 10);

  // Verifica se já existe por email ou matrícula
  const existing = db.prepare('SELECT id, email, matricula FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?').get(email.toLowerCase(), matricula.toLowerCase());

  if (existing) {
    db.prepare(`
      UPDATE usuarios 
      SET nome = ?, email = ?, matricula = ?, senha_hash = ?, perfil = ?, grupo = ?, primeiro_acesso = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nome, email, matricula, senhaHash, perfil, grupo, primeiroAcesso, ativo, existing.id);
    console.log(`✅ Usuária atualizada com sucesso (ID: ${existing.id})`);
  } else {
    const result = db.prepare(`
      INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nome, email, matricula, senhaHash, perfil, grupo, primeiroAcesso, ativo);
    console.log(`✅ Usuária cadastrada com sucesso (ID: ${result.lastInsertRowid})`);
  }

  saveDatabase();

  const user = db.prepare('SELECT id, nome, email, matricula, perfil, grupo, primeiro_acesso, ativo FROM usuarios WHERE LOWER(email) = ?').get(email.toLowerCase());
  console.log('Dados cadastrados:', user);

  process.exit(0);
}

addConsultora();
