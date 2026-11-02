import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = path.resolve('database/database.sqlite');
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function pushAllToNeon() {
  if (!dbUrl) {
    console.error('❌ DATABASE_URL não configurada no .env');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const sqliteDb = new SQL.Database(buffer);

  const queryAll = (sql) => {
    const res = sqliteDb.exec(sql);
    if (!res || res.length === 0) return [];
    const { columns, values } = res[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  };

  const usuarios = queryAll('SELECT * FROM usuarios ORDER BY id ASC');
  const tecnicos = queryAll('SELECT * FROM tecnicos ORDER BY matricula ASC');
  const clientes = queryAll('SELECT * FROM clientes ORDER BY numero_contrato ASC');
  const orcamentos = queryAll('SELECT * FROM chamados_orcamentos ORDER BY id ASC');

  console.log(`📦 Estado Local SQLite: ${usuarios.length} usuários | ${tecnicos.length} técnicos | ${clientes.length} clientes | ${orcamentos.length} orçamentos`);

  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🌐 Sincronizando dados locais para o Neon PostgreSQL...');

    // 1. Sincroniza Usuários
    const validEmails = usuarios.map(u => String(u.email).toLowerCase().trim());
    if (validEmails.length > 0) {
      await pool.query('DELETE FROM usuarios WHERE LOWER(email) != ALL($1::text[])', [validEmails]);
    }
    for (const u of usuarios) {
      await pool.query(`
        INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          nome = EXCLUDED.nome,
          matricula = EXCLUDED.matricula,
          senha_hash = EXCLUDED.senha_hash,
          perfil = EXCLUDED.perfil,
          grupo = EXCLUDED.grupo,
          primeiro_acesso = EXCLUDED.primeiro_acesso,
          ativo = EXCLUDED.ativo,
          updated_at = CURRENT_TIMESTAMP
      `, [
        u.nome,
        String(u.email).toLowerCase().trim(),
        u.matricula,
        u.senha_hash,
        u.perfil,
        u.grupo || 'G11',
        u.primeiro_acesso ?? 0,
        u.ativo ?? 1
      ]);
    }

    // 2. Sincroniza Técnicos
    const validMatriculas = tecnicos.map(t => String(t.matricula).trim());
    if (validMatriculas.length > 0) {
      await pool.query('DELETE FROM tecnicos WHERE matricula != ALL($1::text[])', [validMatriculas]);
    }
    for (const t of tecnicos) {
      await pool.query(`
        INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (matricula) DO UPDATE SET
          funcao = EXCLUDED.funcao,
          nome_sobrenome = EXCLUDED.nome_sobrenome,
          email = EXCLUDED.email,
          telefone = EXCLUDED.telefone
      `, [
        t.matricula,
        t.funcao || 'Preventivo',
        t.nome_sobrenome,
        t.email || null,
        t.telefone || null
      ]);
    }

    // 3. Sincroniza Clientes
    for (const c of clientes) {
      await pool.query(`
        INSERT INTO clientes (numero_contrato, nome_cliente, created_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (numero_contrato) DO UPDATE SET
          nome_cliente = EXCLUDED.nome_cliente
      `, [c.numero_contrato, c.nome_cliente]);
    }

    // 4. Sincroniza Orçamentos
    await pool.query(`
      ALTER TABLE chamados_orcamentos ADD COLUMN IF NOT EXISTS observacao_tecnico VARCHAR(200);
      ALTER TABLE chamados_orcamentos ADD COLUMN IF NOT EXISTS nota_urgencia INTEGER;
    `);
    if (orcamentos.length === 0) {
      await pool.query('DELETE FROM chamados_orcamentos');
    } else {
      const validPgos = orcamentos.map(o => String(o.numero_pgo).trim());
      await pool.query('DELETE FROM chamados_orcamentos WHERE numero_pgo != ALL($1::text[])', [validPgos]);
      for (const o of orcamentos) {
        await pool.query(`
          INSERT INTO chamados_orcamentos (
            matricula_tecnico, nome_tecnico, tipo_servico, numero_pgo,
            g_origem, numero_contrato, nome_cliente, numero_orcamento,
            descricao_servico, observacao_tecnico, nota_urgencia,
            valor_total, data_liberacao, geor_liberou,
            data_envio_cliente, status, created_by_id, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NULL, CURRENT_TIMESTAMP
          )
          ON CONFLICT (numero_pgo) DO UPDATE SET
            matricula_tecnico = EXCLUDED.matricula_tecnico,
            nome_tecnico = EXCLUDED.nome_tecnico,
            tipo_servico = EXCLUDED.tipo_servico,
            g_origem = EXCLUDED.g_origem,
            numero_contrato = EXCLUDED.numero_contrato,
            nome_cliente = EXCLUDED.nome_cliente,
            numero_orcamento = EXCLUDED.numero_orcamento,
            descricao_servico = EXCLUDED.descricao_servico,
            observacao_tecnico = EXCLUDED.observacao_tecnico,
            nota_urgencia = EXCLUDED.nota_urgencia,
            valor_total = EXCLUDED.valor_total,
            data_liberacao = EXCLUDED.data_liberacao,
            geor_liberou = EXCLUDED.geor_liberou,
            data_envio_cliente = EXCLUDED.data_envio_cliente,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
        `, [
          o.matricula_tecnico,
          o.nome_tecnico,
          o.tipo_servico,
          o.numero_pgo,
          o.g_origem || 'G11',
          o.numero_contrato,
          o.nome_cliente,
          o.numero_orcamento || 'Aguardando Orçamento',
          o.descricao_servico || null,
          o.observacao_tecnico || null,
          o.nota_urgencia !== null && o.nota_urgencia !== undefined && o.nota_urgencia !== '' ? Number(o.nota_urgencia) : null,
          Number(o.valor_total) || 0.00,
          o.data_liberacao || null,
          o.geor_liberou || 'Não',
          o.data_envio_cliente || null,
          o.status || 'Aberto'
        ]);
      }
    }

    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM usuarios) as usr,
        (SELECT COUNT(*) FROM tecnicos) as tec,
        (SELECT COUNT(*) FROM clientes) as cli,
        (SELECT COUNT(*) FROM chamados_orcamentos) as orc
    `);
    console.log('✅ Sincronização com Neon PostgreSQL concluída com sucesso!', counts.rows[0]);
  } finally {
    await pool.end();
  }
}

pushAllToNeon().catch(err => {
  console.error('❌ Erro ao sincronizar com Neon:', err);
  process.exit(1);
});
