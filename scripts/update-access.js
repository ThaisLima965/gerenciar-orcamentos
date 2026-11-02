import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { initDatabase, db, saveDatabase } from '../src/config/database.js';

dotenv.config();

const COLABORADORES_ANEXO = [
  // G11
  { grupo: 'G11', perfil: 'SUPERVISOR', funcao: 'Supervisor', matricula: '55007886', nome: 'GENILSO RIBEIRO MENDES', email: 'genilso.mendes@tkelevator.com', telefone: '97596-3160' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55011768', nome: 'CAIO CEZAR SILVA', email: 'caio.silva2@tkelevator.com', telefone: '97180-6587' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55021126', nome: 'LEONARDO MENEZES SILVERIO', email: 'leonardo.silverio@tkelevator.com', telefone: '97588-9897' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55018256', nome: 'GABRIEL HENRIQUE DA SILVA SANTOS', email: 'gabriel.santos1@tkelevator.com', telefone: '99873-8164' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55018990', nome: 'GUILHERME JUAN DOUETTS', email: 'guilherme.douetts@tkelevator.com', telefone: '99709-7625' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55012528', nome: 'JOAO LUCAS COSTA DO CARMO', email: 'joao.carmo@tkelevator.com', telefone: '99590-5635' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55020162', nome: 'RODRIGO DE OLIVEIRA MACHADO', email: 'rodrigo.machado@tkelevator.com', telefone: '93725-5808' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55019331', nome: 'GUILHERME GONÇALVES MURCA', email: 'guilherme.murca@tkelevator.com', telefone: '99593-3728' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55011402', nome: 'ALAN BATISTA BARBOSA BARROS', email: 'alan.barros@tkelevator.com', telefone: '99826-6025' },
  { grupo: 'G11', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55011011', nome: 'SIDNEI SANTOS POLICARPO', email: 'sidnei.policarpo@tkelevator.com', telefone: '99954-0782' },

  // G06
  { grupo: 'G06', perfil: 'SUPERVISOR', funcao: 'Supervisor', matricula: '55012476', nome: 'JOSEMAR ORLANDINI', email: 'josemar.orlandini@tkelevator.com', telefone: '99745-9125' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55007503', nome: 'ARQUIMEDES PIRES DA SILVA', email: 'arquimedes.silva@tkelevator.com', telefone: '99584-2339' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55015408', nome: 'ALBENES SILVA CHAGAS', email: 'albenes.chagas@tkelevator.com', telefone: '97223-8863' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55008491', nome: 'MARCELO SEIJI HIRATSUKA', email: 'marcelo.hiratsuka@tkelevator.com', telefone: '97425-0852' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55018920', nome: 'BRUNO FERREIRA CORREIA DE SOUZA', email: 'bruno.souza2@tkelevator.com', telefone: '95530-4572' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55019205', nome: 'REGINALDO TAVARES FERREIRA', email: 'reginaldo.ferreira@tkelevator.com', telefone: '99504-8277' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Residente', matricula: '55011293', nome: 'ANDERSON VINICIUS DO NASCIMENTO', email: 'anderson.nascimento@tkelevator.com', telefone: '97449-6822' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55012716', nome: 'DENIS CAMPOS ALVES LUIZ COSTA', email: 'denis.costa@tkelevator.com', telefone: '99578-3754' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55003302', nome: 'RONALDO LOPES DA COSTA', email: 'ronaldo.costa@tkelevator.com', telefone: '99590-7604' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55010003', nome: 'SERGIO DA SILVA SOUZA', email: 'sergio.souza@tkelevator.com', telefone: '97142-9244' },
  { grupo: 'G06', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55016366', nome: 'VINICIUS BARBOSA BALTAZAR DA SILVA', email: 'vinicius.silva@tkelevator.com', telefone: '93323-8925' },

  // G05
  { grupo: 'G05', perfil: 'SUPERVISOR', funcao: 'Supervisor', matricula: '55021156', nome: 'MARCO ANTONIO ARANHA SALGADO FILHO', email: 'marco.filho@tkelevator.com', telefone: '97221-5567' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55007943', nome: 'CARLOS FELIPE DA SILVA LEMOS', email: 'carlos.lemos@tkelevator.com', telefone: '95037-7125' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55006730', nome: 'GILVAN JOAQUIM DE SOUSA', email: 'gilvan.sousa@tkelevator.com', telefone: '99839-5726' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55014054', nome: 'ISMAEL GONCALVES DOS SANTOS', email: 'ismael.santos2@tkelevator.com', telefone: '95049-2657' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55012050', nome: 'JEFFERSON BARBOSA GRIGORIO', email: 'jefferson.grigorio@tkelevator.com', telefone: '99593-0652' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55013973', nome: 'JEFFERSON SOUZA MARQUES', email: 'jefferson.marques@tkelevator.com', telefone: '99795-4140' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Preventivo', matricula: '55020622', nome: 'EMERSON DA SILVA NASCIMENTO IKEDA', email: 'emerson.ikeda@tkelevator.com', telefone: '94218-9122' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55002462', nome: 'FERNANDO DE MENDONCA COSTA', email: 'fernando.costa@tkelevator.com', telefone: '99593-8255' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55018175', nome: 'GABRIEL NASCIMENTO DE OLIVEIRA', email: 'gabriel.oliveira@tkelevator.com', telefone: '95772-5972' },
  { grupo: 'G05', perfil: 'TECNICO', funcao: 'Corretivo', matricula: '55010811', nome: 'RODRIGO ALVES DA SILVA', email: 'rodrigo.silva3@tkelevator.com', telefone: '99595-7899' }
];

async function updateAccessControl() {
  console.log('🔐 Iniciando atualização da Gestão de Acessos (SQLite)...');
  await initDatabase();

  // 1. Captura senhas atuais caso algum colaborador já tivesse trocado a senha (especialmente Thaís)
  const existingUsers = db.prepare('SELECT * FROM usuarios').all();
  const userByEmail = new Map();
  const userByMatricula = new Map();
  for (const u of existingUsers) {
    if (u.email) userByEmail.set(u.email.toLowerCase().trim(), u);
    if (u.matricula) userByMatricula.set(u.matricula.trim(), u);
  }

  const thaisExisting = userByEmail.get('thais.lima@tkelevator.com') || userByMatricula.get('55011190');
  const thaisHash = thaisExisting?.senha_hash || '$2b$10$8tMcMZRMo8kYjRLFbP3XResIk0N1hnUo8lbrrjohqBh9p430wCF2m';
  const defaultProvisionalHash = bcrypt.hashSync('Tke@1234', 10);

  // 2. Limpa todos os usuários e técnicos existentes (e orçamentos de teste residuais)
  db.prepare('DELETE FROM chamados_orcamentos WHERE numero_pgo LIKE "PGO-TEST-%"').run();
  db.prepare('UPDATE chamados_orcamentos SET created_by_id = NULL').run();
  db.prepare('DELETE FROM tokens_redefinicao_senha').run();
  db.prepare('DELETE FROM usuarios').run();
  db.prepare('DELETE FROM tecnicos').run();

  // 3. Insere Thaís da Silva Lima (Consultora) mantendo seu acesso ativo
  const stmtInsertUser = db.prepare(`
    INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  stmtInsertUser.run(
    'Thaís da Silva Lima',
    'thais.lima@tkelevator.com',
    '55011190',
    thaisHash,
    'CONSULTORA',
    'G11',
    0
  );

  const stmtInsertTec = db.prepare(`
    INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone)
    VALUES (?, ?, ?, ?, ?)
  `);

  // 4. Insere exclusivamente os 31 colaboradores do anexo
  for (const colab of COLABORADORES_ANEXO) {
    const prevUser = userByEmail.get(colab.email.toLowerCase()) || userByMatricula.get(colab.matricula);
    const hashToUse = prevUser?.senha_hash || defaultProvisionalHash;
    const primeiroAcessoToUse = prevUser !== undefined ? prevUser.primeiro_acesso : 1;

    stmtInsertUser.run(
      colab.nome,
      colab.email.toLowerCase().trim(),
      colab.matricula.trim(),
      hashToUse,
      colab.perfil,
      colab.grupo,
      primeiroAcessoToUse
    );

    // Na tabela tecnicos, cadastramos os técnicos (e supervisores caso aplicável, mas no relatório de premiação apenas os 28 técnicos aparecem)
    if (colab.perfil === 'TECNICO') {
      stmtInsertTec.run(
        colab.matricula.trim(),
        colab.funcao,
        colab.nome,
        colab.email.toLowerCase().trim(),
        colab.telefone.trim()
      );
    }
  }

  saveDatabase();

  const finalUsers = db.prepare('SELECT id, nome, email, matricula, perfil, grupo, ativo FROM usuarios ORDER BY id ASC').all();
  const finalTecs = db.prepare('SELECT matricula, funcao, nome_sobrenome, email, telefone FROM tecnicos ORDER BY matricula ASC').all();
  console.log(`✅ SQLite atualizado com sucesso: ${finalUsers.length} usuários ativos (1 Consultora + 3 Supervisores + 28 Técnicos) e ${finalTecs.length} técnicos na base.`);

  // 5. Se possível conectar ao Neon PostgreSQL (quando executado fora do sandbox), sincroniza exatamente a mesma base
  if (process.env.DATABASE_URL) {
    const { Pool } = pg;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("DELETE FROM chamados_orcamentos WHERE numero_pgo LIKE 'PGO-TEST-%'");
        await client.query('UPDATE chamados_orcamentos SET created_by_id = NULL');
        await client.query('DELETE FROM tokens_redefinicao_senha');
        await client.query('DELETE FROM usuarios');
        await client.query('DELETE FROM tecnicos');

        const allSqliteUsers = db.prepare('SELECT * FROM usuarios ORDER BY id ASC').all();
        for (const u of allSqliteUsers) {
          await client.query(`
            INSERT INTO usuarios (id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [u.id, u.nome, u.email, u.matricula, u.senha_hash, u.perfil, u.grupo, u.primeiro_acesso, u.ativo]);
        }
        await client.query("SELECT setval(pg_get_serial_sequence('usuarios', 'id'), COALESCE((SELECT MAX(id) FROM usuarios), 1));");

        for (const t of finalTecs) {
          await client.query(`
            INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone)
            VALUES ($1, $2, $3, $4, $5)
          `, [t.matricula, t.funcao, t.nome_sobrenome, t.email, t.telefone]);
        }

        await client.query('COMMIT');
        console.log('🌐 Sincronização com Neon PostgreSQL concluída com sucesso!');
      } catch (pgErr) {
        await client.query('ROLLBACK');
        console.warn('⚠️ Erro ao transacionar no Neon:', pgErr.message);
      } finally {
        client.release();
      }
    } catch (connErr) {
      console.warn('ℹ️ Banco Neon não acessível neste modo (será sincronizado com permissão de rede):', connErr.message);
    } finally {
      await pool.end();
    }
  }
}

updateAccessControl();
