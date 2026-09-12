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

async function runSeed() {
  console.log('🌱 ========================================================');
  console.log('🌱 INICIANDO CARGA INICIAL DE DADOS DE TESTE (SEEDS TKE)');
  console.log('🌱 ========================================================\n');

  try {
    const SQL = await initSqlJs();
    let sqlDb;

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
    } else {
      sqlDb = new SQL.Database();
    }

    // 1. Executa Schema DDL
    const schemaPath = path.join(dbDirectory, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      sqlDb.run(schemaSql);
      console.log('✅ [1/3] Schema e tabelas verificadas/criadas.');
    }

    // Migrações de colunas caso o banco já existisse
    try {
      sqlDb.run('ALTER TABLE chamados_orcamentos ADD COLUMN descricao_servico TEXT;');
    } catch (e) {}

    try {
      sqlDb.run("ALTER TABLE tecnicos ADD COLUMN funcao VARCHAR(80) DEFAULT 'Técnico de Manutenção';");
    } catch (e) {}

    try {
      sqlDb.run("ALTER TABLE chamados_orcamentos ADD COLUMN g_origem VARCHAR(10) DEFAULT 'G11';");
    } catch (e) {}

    // 2. Executa Seed Data
    const seedPath = path.join(dbDirectory, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      sqlDb.run(seedSql);
      console.log('✅ [2/3] Dados de teste (Usuários, 10 Clientes, 8 Técnicos, Orçamentos) inseridos.');
    }

    // 3. Persiste em disco
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('✅ [3/3] Banco de dados salvo com sucesso em:', dbPath);

    console.log('\n===============================================================');
    console.log('🎉 SEED CONCLUÍDO COM SUCESSO!');
    console.log('👑 Consultora (Admin): consultora@empresa.com | Senha: Senha@12345');
    console.log('👔 Supervisor:         supervisor@empresa.com | Senha: Senha@12345');
    console.log('🛠️  Técnico:            1001 (ou tecnico@empresa.com) | Senha: Senha@12345');
    console.log('📋 10 Clientes (CT-2024-001 a CT-2024-010)');
    console.log('👥 8 Técnicos (Matrículas 1001 a 1008)');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('❌ Erro ao executar seeds:', error);
    process.exit(1);
  }
}

runSeed();
