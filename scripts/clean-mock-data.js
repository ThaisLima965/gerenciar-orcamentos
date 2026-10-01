import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDirectory = path.resolve(__dirname, '../database');
const dbPath = process.env.DB_PATH 
  ? path.resolve(process.cwd(), process.env.DB_PATH) 
  : path.join(dbDirectory, 'database.sqlite');

async function cleanMockData() {
  console.log('🧹 ========================================================');
  console.log('🧹 INICIANDO LIMPEZA DE DADOS FICTÍCIOS / TESTES');
  console.log('🧹 ========================================================\n');

  if (!fs.existsSync(dbPath)) {
    console.log('⚠️ Arquivo de banco de dados não encontrado em:', dbPath);
    return;
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const sqlDb = new SQL.Database(fileBuffer);

  // 1. Limpa Chamados e Orçamentos
  const countOrcBefore = sqlDb.exec('SELECT COUNT(*) FROM chamados_orcamentos')[0]?.values[0][0] || 0;
  sqlDb.run('DELETE FROM chamados_orcamentos;');
  console.log(`✅ [1/4] chamados_orcamentos: ${countOrcBefore} registros fictícios excluídos.`);

  // 2. Limpa Clientes
  const countCliBefore = sqlDb.exec('SELECT COUNT(*) FROM clientes')[0]?.values[0][0] || 0;
  sqlDb.run('DELETE FROM clientes;');
  console.log(`✅ [2/4] clientes: ${countCliBefore} registros fictícios excluídos.`);

  // 3. Limpa Técnicos
  const countTecBefore = sqlDb.exec('SELECT COUNT(*) FROM tecnicos')[0]?.values[0][0] || 0;
  sqlDb.run('DELETE FROM tecnicos;');
  console.log(`✅ [3/4] tecnicos: ${countTecBefore} registros fictícios excluídos.`);

  // 4. Limpa Usuários de teste mantendo apenas a Consultora Admin (ID 1 / consultora@empresa.com)
  const countUsrBefore = sqlDb.exec('SELECT COUNT(*) FROM usuarios')[0]?.values[0][0] || 0;
  sqlDb.run("DELETE FROM usuarios WHERE email != 'consultora@empresa.com' AND id != 1;");
  
  // Garante que a conta Consultora Admin exista com a senha padrão Senha@12345
  sqlDb.run(`
    INSERT OR REPLACE INTO usuarios (id, nome, email, matricula, senha_hash, perfil, ativo, primeiro_acesso, grupo) VALUES
    (1, 'Camila Mendes (Consultora Admin)', 'consultora@empresa.com', 'CONS001', '$2b$10$WW7UyfZ75sbEKJqZKihV/OpCaB15qPt4NSiIojyxrh8qeuWnzVpn6', 'CONSULTORA', 1, 0, 'G11');
  `);
  const countUsrAfter = sqlDb.exec('SELECT COUNT(*) FROM usuarios')[0]?.values[0][0] || 0;
  console.log(`✅ [4/4] usuarios: ${countUsrBefore - countUsrAfter} usuários de teste excluídos. Restante: ${countUsrAfter} (Consultora Admin).`);

  // 5. Salva banco em disco
  const data = sqlDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('\n💾 Banco de dados limpo e salvo em disco com sucesso!');

  console.log('\n===============================================================');
  console.log('✨ LIMPEZA CONCLUÍDA!');
  console.log('👑 Acesso de Login Ativo:');
  console.log('   - E-mail: consultora@empresa.com');
  console.log('   - Senha:  Senha@12345');
  console.log('   - Perfil: CONSULTORA (Admin Geral)');
  console.log('===============================================================\n');
}

cleanMockData().catch(err => {
  console.error('❌ Erro durante a limpeza:', err);
  process.exit(1);
});
