import pg from 'pg';
import { initDatabase, db } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const NEON_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_p4LWVa7wSyXQ@ep-flat-art-ac9238wc-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';

const { Pool } = pg;
const pool = new Pool({
  connectionString: NEON_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

async function migrateData() {
  console.log('🚀 [Migração Neon] Iniciando processo de migração SQLite -> Neon PostgreSQL...');
  
  // 1. Inicializa SQLite local
  await initDatabase();
  console.log('📂 [SQLite] Banco de dados local carregado.');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // =====================================================================
    // 2. MIGRAÇÃO DE USUÁRIOS
    // =====================================================================
    const usuarios = db.prepare('SELECT * FROM usuarios ORDER BY id ASC').all();
    console.log(`👤 [Migração] Migrando ${usuarios.length} usuários para o Neon...`);

    for (const u of usuarios) {
      await client.query(`
        INSERT INTO usuarios (id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          email = EXCLUDED.email,
          matricula = EXCLUDED.matricula,
          senha_hash = EXCLUDED.senha_hash,
          perfil = EXCLUDED.perfil,
          grupo = EXCLUDED.grupo,
          primeiro_acesso = EXCLUDED.primeiro_acesso,
          ativo = EXCLUDED.ativo,
          updated_at = CURRENT_TIMESTAMP
      `, [
        u.id,
        u.nome,
        u.email,
        u.matricula,
        u.senha_hash,
        u.perfil,
        u.grupo || 'G11',
        u.primeiro_acesso !== undefined ? u.primeiro_acesso : 1,
        u.ativo !== undefined ? u.ativo : 1,
        u.created_at || new Date().toISOString(),
        u.updated_at || new Date().toISOString()
      ]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 1));");
    console.log('   ✅ Usuários migrados com sucesso.');

    // =====================================================================
    // 3. MIGRAÇÃO DE CLIENTES
    // =====================================================================
    const clientes = db.prepare('SELECT * FROM clientes').all();
    console.log(`🏢 [Migração] Migrando ${clientes.length} clientes para o Neon...`);

    for (const c of clientes) {
      await client.query(`
        INSERT INTO clientes (numero_contrato, nome_cliente, created_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (numero_contrato) DO UPDATE SET
          nome_cliente = EXCLUDED.nome_cliente
      `, [
        c.numero_contrato,
        c.nome_cliente,
        c.created_at || new Date().toISOString()
      ]);
    }
    console.log('   ✅ Clientes migrados com sucesso.');

    // =====================================================================
    // 4. MIGRAÇÃO DE TÉCNICOS
    // =====================================================================
    const tecnicos = db.prepare('SELECT * FROM tecnicos').all();
    console.log(`🔧 [Migração] Migrando ${tecnicos.length} técnicos para o Neon...`);

    for (const t of tecnicos) {
      await client.query(`
        INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (matricula) DO UPDATE SET
          funcao = EXCLUDED.funcao,
          nome_sobrenome = EXCLUDED.nome_sobrenome,
          email = EXCLUDED.email,
          telefone = EXCLUDED.telefone
      `, [
        t.matricula,
        t.funcao || 'Técnico de Manutenção',
        t.nome_sobrenome,
        t.email || null,
        t.telefone || null,
        t.created_at || new Date().toISOString()
      ]);
    }
    console.log('   ✅ Técnicos migrados com sucesso.');

    // =====================================================================
    // 5. MIGRAÇÃO DE CHAMADOS / ORÇAMENTOS
    // =====================================================================
    const chamados = db.prepare('SELECT * FROM chamados_orcamentos ORDER BY id ASC').all();
    console.log(`📑 [Migração] Migrando ${chamados.length} chamados/orçamentos para o Neon...`);

    for (const ch of chamados) {
      // Garante que chaves estrangeiras válidas existam
      let clienteContrato = ch.numero_contrato;
      const cliCheck = await client.query('SELECT numero_contrato FROM clientes WHERE numero_contrato = $1', [clienteContrato]);
      if (cliCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO clientes (numero_contrato, nome_cliente)
          VALUES ($1, $2)
          ON CONFLICT (numero_contrato) DO NOTHING
        `, [clienteContrato, ch.nome_cliente || 'Cliente Importado']);
      }

      let tecnicoMatricula = ch.matricula_tecnico;
      const tecCheck = await client.query('SELECT matricula FROM tecnicos WHERE matricula = $1', [tecnicoMatricula]);
      if (tecCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO tecnicos (matricula, funcao, nome_sobrenome)
          VALUES ($1, $2, $3)
          ON CONFLICT (matricula) DO NOTHING
        `, [tecnicoMatricula, 'Técnico de Manutenção', ch.nome_tecnico || 'Técnico']);
      }

      await client.query(`
        INSERT INTO chamados_orcamentos (
          id, matricula_tecnico, nome_tecnico, tipo_servico, numero_pgo, g_origem,
          numero_contrato, nome_cliente, numero_orcamento, descricao_servico,
          data_liberacao, geor_liberou, data_envio_cliente, status, valor_total,
          data_criacao, created_by_id, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18
        )
        ON CONFLICT (id) DO UPDATE SET
          matricula_tecnico = EXCLUDED.matricula_tecnico,
          nome_tecnico = EXCLUDED.nome_tecnico,
          tipo_servico = EXCLUDED.tipo_servico,
          numero_pgo = EXCLUDED.numero_pgo,
          g_origem = EXCLUDED.g_origem,
          numero_contrato = EXCLUDED.numero_contrato,
          nome_cliente = EXCLUDED.nome_cliente,
          numero_orcamento = EXCLUDED.numero_orcamento,
          descricao_servico = EXCLUDED.descricao_servico,
          data_liberacao = EXCLUDED.data_liberacao,
          geor_liberou = EXCLUDED.geor_liberou,
          data_envio_cliente = EXCLUDED.data_envio_cliente,
          status = EXCLUDED.status,
          valor_total = EXCLUDED.valor_total,
          updated_at = CURRENT_TIMESTAMP
      `, [
        ch.id,
        ch.matricula_tecnico,
        ch.nome_tecnico,
        ch.tipo_servico,
        ch.numero_pgo,
        ch.g_origem || 'G11',
        ch.numero_contrato,
        ch.nome_cliente,
        ch.numero_orcamento || 'Aguardando Orçamento',
        ch.descricao_servico || null,
        ch.data_liberacao || null,
        ch.geor_liberou || 'Não',
        ch.data_envio_cliente || null,
        ch.status || 'Aberto',
        Number(ch.valor_total) || 0.00,
        ch.data_criacao || new Date().toISOString(),
        ch.created_by_id || null,
        ch.updated_at || new Date().toISOString()
      ]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('chamados_orcamentos', 'id'), COALESCE((SELECT MAX(id) FROM chamados_orcamentos), 1));");
    console.log('   ✅ Chamados migrados com sucesso.');

    await client.query('COMMIT');
    console.log('\n🎉 ========================================================');
    console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO NO NEON POSTGRESQL!');
    console.log('🎉 ========================================================');

    // Verificação de Contagens Finais no Neon
    const countsRes = await client.query(`
      SELECT 'usuarios' as tabela, count(*) as total FROM usuarios
      UNION ALL
      SELECT 'clientes' as tabela, count(*) as total FROM clientes
      UNION ALL
      SELECT 'tecnicos' as tabela, count(*) as total FROM tecnicos
      UNION ALL
      SELECT 'chamados_orcamentos' as tabela, count(*) as total FROM chamados_orcamentos;
    `);

    console.log('\n📊 [Validação de Dados no Neon PostgreSQL]:');
    countsRes.rows.forEach(r => {
      console.log(`   - ${r.tabela}: ${r.total} registros gravados.`);
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [Migração Neon] Erro crítico durante migração:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateData().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
