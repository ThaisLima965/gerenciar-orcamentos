import pg from 'pg';
import { initDatabase, db, saveDatabase } from '../src/config/database.js';
import { normalizeTecnicoFuncao, sanitizeUtf8 } from '../src/utils/encodingUtils.js';
import dotenv from 'dotenv';

dotenv.config();

const NEON_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_p4LWVa7wSyXQ@ep-flat-art-ac9238wc-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';

const { Pool } = pg;
const pool = new Pool({
  connectionString: NEON_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

async function runCleanupAndNormalization() {
  console.log('=====================================================');
  console.log('🧹 INICIANDO LIMPEZA DE DADOS E PADRONIZAÇÃO UTF-8');
  console.log('=====================================================');

  // 1. Carrega SQLite
  await initDatabase();
  console.log('📂 [SQLite] Banco de dados local inicializado.');

  // ===================================================================
  // PARTE A: LIMPEZA E PADRONIZAÇÃO NO SQLITE
  // ===================================================================
  console.log('\n--- LIMPEZA NO SQLITE LOCAL ---');
  
  // A1. Limpar tabela de orçamentos (vazia para importação oficial)
  db.exec('DELETE FROM chamados_orcamentos;');
  console.log('✅ [SQLite] Tabela chamados_orcamentos esvaziada com sucesso (0 registros).');

  // A2. Remover linha lixo de cabeçalho importada por engano em tecnicos
  db.exec("DELETE FROM tecnicos WHERE LOWER(matricula) = 'matricula';");

  // A3. Normalizar Técnicos no SQLite
  const tecnicosSqlite = db.prepare('SELECT matricula, funcao, nome_sobrenome, email, telefone FROM tecnicos').all();
  console.log(`🔧 [SQLite] Normalizando ${tecnicosSqlite.length} técnicos para os 3 níveis (Preventivo, Corretivo, Residente)...`);

  const updateTecStmt = db.prepare('UPDATE tecnicos SET funcao = ?, nome_sobrenome = ? WHERE matricula = ?');
  for (const tec of tecnicosSqlite) {
    const cleanFuncao = normalizeTecnicoFuncao(tec.funcao);
    let cleanNome = sanitizeUtf8(tec.nome_sobrenome || '');
    // Remove sufixos como (Técnico Master) ou (TÃ©cnico Master)
    cleanNome = cleanNome.replace(/\s*\([^)]*T[eé]cnico[^)]*\)/gi, '').trim();
    if (!cleanNome) cleanNome = sanitizeUtf8(tec.nome_sobrenome);

    updateTecStmt.run(cleanFuncao, cleanNome, tec.matricula);
  }
  console.log('✅ [SQLite] Técnicos normalizados com sucesso.');

  // A4. Normalizar Usuários no SQLite
  const usuariosSqlite = db.prepare('SELECT id, nome, email FROM usuarios').all();
  const updateUsrStmt = db.prepare('UPDATE usuarios SET nome = ? WHERE id = ?');
  for (const usr of usuariosSqlite) {
    const cleanNome = sanitizeUtf8(usr.nome);
    if (cleanNome !== usr.nome) {
      updateUsrStmt.run(cleanNome, usr.id);
    }
  }
  console.log('✅ [SQLite] Usuários sanitizados (UTF-8).');

  // A5. Normalizar Clientes no SQLite
  const clientesSqlite = db.prepare('SELECT numero_contrato, nome_cliente FROM clientes').all();
  const updateCliStmt = db.prepare('UPDATE clientes SET nome_cliente = ? WHERE numero_contrato = ?');
  for (const cli of clientesSqlite) {
    const cleanNome = sanitizeUtf8(cli.nome_cliente);
    if (cleanNome !== cli.nome_cliente) {
      updateCliStmt.run(cleanNome, cli.numero_contrato);
    }
  }
  console.log('✅ [SQLite] Clientes sanitizados (UTF-8).');

  saveDatabase();

  // ===================================================================
  // PARTE B: LIMPEZA E PADRONIZAÇÃO NO NEON POSTGRESQL
  // ===================================================================
  console.log('\n--- LIMPEZA NO NEON POSTGRESQL ---');
  let neonClient = null;
  try {
    neonClient = await pool.connect();
    await neonClient.query('BEGIN');

    // B1. Limpar tabela de orçamentos no Neon
    await neonClient.query('DELETE FROM chamados_orcamentos;');
    console.log('✅ [Neon] Tabela chamados_orcamentos esvaziada com sucesso (0 registros).');

    // B2. Remover cabeçalho indevido em tecnicos
    await neonClient.query("DELETE FROM tecnicos WHERE LOWER(matricula) = 'matricula';");

    // B3. Normalizar Técnicos no Neon
    const resTecNeon = await neonClient.query('SELECT matricula, funcao, nome_sobrenome FROM tecnicos');
    console.log(`🔧 [Neon] Normalizando ${resTecNeon.rows.length} técnicos no Neon...`);

    for (const tec of resTecNeon.rows) {
      const cleanFuncao = normalizeTecnicoFuncao(tec.funcao);
      let cleanNome = sanitizeUtf8(tec.nome_sobrenome || '');
      cleanNome = cleanNome.replace(/\s*\([^)]*T[eé]cnico[^)]*\)/gi, '').trim();
      if (!cleanNome) cleanNome = sanitizeUtf8(tec.nome_sobrenome);

      await neonClient.query(
        'UPDATE tecnicos SET funcao = $1, nome_sobrenome = $2 WHERE matricula = $3',
        [cleanFuncao, cleanNome, tec.matricula]
      );
    }
    console.log('✅ [Neon] Técnicos normalizados no Neon.');

    // B4. Normalizar Usuários no Neon
    const resUsrNeon = await neonClient.query('SELECT id, nome FROM usuarios');
    for (const usr of resUsrNeon.rows) {
      const cleanNome = sanitizeUtf8(usr.nome);
      if (cleanNome !== usr.nome) {
        await neonClient.query('UPDATE usuarios SET nome = $1 WHERE id = $2', [cleanNome, usr.id]);
      }
    }
    console.log('✅ [Neon] Usuários sanitizados no Neon.');

    // B5. Normalizar Clientes no Neon
    const resCliNeon = await neonClient.query('SELECT numero_contrato, nome_cliente FROM clientes');
    for (const cli of resCliNeon.rows) {
      const cleanNome = sanitizeUtf8(cli.nome_cliente);
      if (cleanNome !== cli.nome_cliente) {
        await neonClient.query('UPDATE clientes SET nome_cliente = $1 WHERE numero_contrato = $2', [cleanNome, cli.numero_contrato]);
      }
    }
    console.log('✅ [Neon] Clientes sanitizados no Neon.');

    await neonClient.query('COMMIT');
    console.log('🎉 [Neon] Transação confirmada com sucesso!');
  } catch (neonErr) {
    if (neonClient) await neonClient.query('ROLLBACK');
    console.error('❌ [Neon] Erro ao atualizar Neon PostgreSQL:', neonErr.message);
    throw neonErr;
  } finally {
    if (neonClient) neonClient.release();
  }

  // ===================================================================
  // PARTE C: VALIDAÇÃO FINAL DOS DADOS
  // ===================================================================
  console.log('\n--- VERIFICAÇÃO FINAL ---');
  const countSqliteOrc = db.prepare('SELECT COUNT(*) as c FROM chamados_orcamentos').get().c;
  const distinctSqliteFuncoes = db.prepare('SELECT DISTINCT funcao FROM tecnicos').all().map(r => r.funcao);
  console.log(`📊 [SQLite] Total orçamentos: ${countSqliteOrc}`);
  console.log(`📊 [SQLite] Funções de técnicos existentes: ${JSON.stringify(distinctSqliteFuncoes)}`);

  const clientVerify = await pool.connect();
  try {
    const resCountNeon = await clientVerify.query('SELECT COUNT(*) as c FROM chamados_orcamentos');
    const resDistNeon = await clientVerify.query('SELECT DISTINCT funcao FROM tecnicos');
    console.log(`📊 [Neon] Total orçamentos: ${resCountNeon.rows[0].c}`);
    console.log(`📊 [Neon] Funções de técnicos existentes: ${JSON.stringify(resDistNeon.rows.map(r => r.funcao))}`);
  } finally {
    clientVerify.release();
    await pool.end();
  }

  console.log('\n🏁 LIMPEZA E PADRONIZAÇÃO CONCLUÍDAS COM SUCESSO!');
}

runCleanupAndNormalization()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
