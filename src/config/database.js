import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);

function getPossibleDbDir() {
  const candidates = [
    path.resolve(__dirname, '../../database'),
    path.resolve(process.cwd(), 'database'),
    path.resolve(__dirname, '../database'),
    path.resolve(__dirname, './database'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), 'database');
}

const dbDirectory = getPossibleDbDir();

if (!isVercel && !fs.existsSync(dbDirectory)) {
  try {
    fs.mkdirSync(dbDirectory, { recursive: true });
  } catch (e) {
    // Silencia criação
  }
}

const dbPath = process.env.DB_PATH 
  ? path.resolve(process.cwd(), process.env.DB_PATH) 
  : (isVercel ? path.join('/tmp', 'database.sqlite') : path.join(dbDirectory, 'database.sqlite'));

let sqlDb = null;

// Salva banco em disco
export function saveDatabase() {
  if (sqlDb) {
    try {
      const data = sqlDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.warn('⚠️ [Database] Aviso ao salvar banco de dados em disco:', err.message);
    }
  }
}

// Localiza arquivo wasm do sql.js
function getSqlWasmBinary() {
  const candidates = [
    path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
    path.resolve(__dirname, 'sql-wasm.wasm'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      try {
        return fs.readFileSync(cand);
      } catch (e) {
        console.warn('⚠️ [Database] Erro ao ler wasm em', cand, e.message);
      }
    }
  }
  return null;
}

// SCHEMA DDL EMBUTIDO DE SEGURANÇA
const EMBEDDED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    matricula VARCHAR(30) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL CHECK(perfil IN ('TECNICO', 'SUPERVISOR', 'CONSULTORA')),
    grupo VARCHAR(10) NOT NULL DEFAULT 'G11' CHECK(grupo IN ('G11', 'G06', 'G05')),
    primeiro_acesso INTEGER NOT NULL DEFAULT 1 CHECK(primeiro_acesso IN (0, 1)),
    ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
    numero_contrato VARCHAR(50) PRIMARY KEY,
    nome_cliente VARCHAR(150) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tecnicos (
    matricula VARCHAR(30) PRIMARY KEY,
    funcao VARCHAR(80) NOT NULL DEFAULT 'Técnico de Manutenção',
    nome_sobrenome VARCHAR(120) NOT NULL,
    email VARCHAR(120),
    telefone VARCHAR(20),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chamados_orcamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricula_tecnico VARCHAR(30) NOT NULL,
    nome_tecnico VARCHAR(120) NOT NULL,
    tipo_servico VARCHAR(20) NOT NULL CHECK(tipo_servico IN ('Preventivo', 'Corretivo')),
    numero_pgo VARCHAR(50) NOT NULL,
    g_origem VARCHAR(10) NOT NULL DEFAULT 'G11' CHECK(g_origem IN ('G11', 'G06', 'G05')),
    numero_contrato VARCHAR(50) NOT NULL,
    nome_cliente VARCHAR(150) NOT NULL,
    numero_orcamento VARCHAR(50) NOT NULL DEFAULT 'Aguardando Orçamento',
    descricao_servico TEXT,
    data_liberacao DATE,
    geor_liberou VARCHAR(10) NOT NULL DEFAULT 'Não' CHECK(geor_liberou IN ('Sim', 'Não')),
    data_envio_cliente DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Aberto' CHECK(
        status IN (
            'Aberto',
            'Em Análise',
            'Aguardando GEOR',
            'Liberado GEOR',
            'Enviado ao Cliente',
            'Aprovado pelo Cliente',
            'Reprovado pelo Cliente',
            'Concluído',
            'Cancelado'
        )
    ),
    valor_total REAL NOT NULL DEFAULT 0.00,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (numero_contrato) REFERENCES clientes(numero_contrato) ON UPDATE CASCADE,
    FOREIGN KEY (matricula_tecnico) REFERENCES tecnicos(matricula) ON UPDATE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chamados_matricula ON chamados_orcamentos(matricula_tecnico);
CREATE INDEX IF NOT EXISTS idx_chamados_contrato ON chamados_orcamentos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados_orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_chamados_geor ON chamados_orcamentos(geor_liberou);
CREATE INDEX IF NOT EXISTS idx_chamados_pgo ON chamados_orcamentos(numero_pgo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios(matricula);
`;

// SEED EMBUTIDO DE SEGURANÇA (30 USUÁRIOS + TÉCNICOS + CLIENTES BASE)
const EMBEDDED_SEED_SQL = `
INSERT OR REPLACE INTO clientes (numero_contrato, nome_cliente) VALUES
('3593', 'Jairo Correa'),
('5477', 'Ed. Corinto');

INSERT OR REPLACE INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone) VALUES
('55011768', 'Técnico Preventivo', 'CAIO CEZAR SILVA', 'caio.silva2@tkelevator.com', NULL),
('55021126', 'Técnico Preventivo', 'LEONARDO MENEZES SILVERIO', 'leonardo.silverio@tkelevator.com', NULL),
('55018256', 'Técnico Preventivo', 'GABRIEL HENRIQUE DA SILVA SANTOS', 'gabriel.santos1@tkelevator.com', NULL),
('55018990', 'Técnico Preventivo', 'GUILHERME JUAN DOUETTS', 'guilherme.douetts@tkelevator.com', NULL),
('55012528', 'Técnico Preventivo', 'JOAO LUCAS COSTA DO CARMO', 'joao.carmo@tkelevator.com', NULL),
('55020162', 'Técnico Preventivo', 'RODRIGO DE OLIVEIRA MACHADO', 'rodrigo.machado@tkelevator.com', NULL),
('55019331', 'Técnico Corretivo', 'GUILHERME GONÇALVES MURCA', 'guilherme.murca@tkelevator.com', NULL),
('55011402', 'Técnico Corretivo', 'ALAN BATISTA BARBOSA BARROS', 'alan.barros@tkelevator.com', NULL),
('55011011', 'Técnico Corretivo', 'SIDNEI SANTOS POLICARPO', 'sidnei.policarpo@tkelevator.com', NULL),
('55007503', 'Técnico Preventivo', 'ARQUIMEDES PIRES DA SILVA', 'arquimedes.silva@tkelevator.com', NULL),
('55015408', 'Técnico Preventivo', 'ALBENES SILVA CHAGAS', 'albenes.chagas@tkelevator.com', NULL),
('55008491', 'Técnico Preventivo', 'MARCELO SEIJI HIRATSUKA', 'marcelo.hiratsuka@tkelevator.com', NULL),
('55018920', 'Técnico Preventivo', 'BRUNO FERREIRA CORREIA DE SOUZA', 'bruno.souza2@tkelevator.com', NULL),
('55019205', 'Técnico Preventivo', 'REGINALDO TAVARES FERREIRA', 'reginaldo.ferreira@tkelevator.com', NULL),
('55011293', 'Técnico Residente', 'ANDERSON VINICIUS DO NASCIMENTO', 'anderson.nascimento@tkelevator.com', NULL),
('55012716', 'Técnico Corretivo', 'DENIS CAMPOS ALVES LUIZ COSTA', 'denis.costa@tkelevator.com', NULL),
('55003302', 'Técnico Corretivo', 'RONALDO LOPES DA COSTA', 'ronaldo.costa@tkelevator.com', NULL),
('55010003', 'Técnico Corretivo', 'SERGIO DA SILVA SOUZA', 'sergio.souza@tkelevator.com', NULL),
('55016366', 'Técnico Corretivo', 'VINICIUS BARBOSA BALTAZAR DA SILVA', 'vinicius.silva@tkelevator.com', NULL),
('55007943', 'Técnico Preventivo', 'CARLOS FELIPE DA SILVA LEMOS', 'carlos.lemos@tkelevator.com', NULL),
('55006730', 'Técnico Preventivo', 'GILVAN JOAQUIM DE SOUSA', 'gilvan.sousa@tkelevator.com', NULL),
('55014054', 'Técnico Preventivo', 'ISMAEL GONCALVES DOS SANTOS', 'ismael.santos2@tkelevator.com', NULL),
('55012050', 'Técnico Preventivo', 'JEFFERSON BARBOSA GRIGORIO', 'jefferson.grigorio@tkelevator.com', NULL),
('55013973', 'Técnico Preventivo', 'JEFFERSON SOUZA MARQUES', 'jefferson.marques@tkelevator.com', NULL),
('55020622', 'Técnico Preventivo', 'EMERSON DA SILVA NASCIMENTO IKEDA', 'emerson.ikeda@tkelevator.com', NULL),
('55002462', 'Técnico Corretivo', 'FERNANDO DE MENDONCA COSTA', 'fernando.costa@tkelevator.com', NULL),
('55018175', 'Técnico Corretivo', 'GABRIEL NASCIMENTO DE OLIVEIRA', 'gabriel.oliveira@tkelevator.com', NULL),
('55010811', 'Técnico Corretivo', 'RODRIGO ALVES DA SILVA', 'rodrigo.silva3@tkelevator.com', NULL);

INSERT OR REPLACE INTO usuarios (matricula, nome, email, senha_hash, perfil, grupo, primeiro_acesso, ativo) VALUES
('55011190', 'Thaís Lima', 'thais.lima@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'CONSULTORA', 'G11', 0, 1),
('55007886', 'GENILSO RIBEIRO MENDES', 'genilso.mendes@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 'G11', 0, 1),
('55012476', 'JOSEMAR ORLANDINI', 'josemar.orlandini@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 'G06', 0, 1),
('55021156', 'MARCO ANTONIO ARANHA SALGADO FILHO', 'marco.filho@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'SUPERVISOR', 'G05', 0, 1),
('55011768', 'CAIO CEZAR SILVA', 'caio.silva2@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55021126', 'LEONARDO MENEZES SILVERIO', 'leonardo.silverio@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55018256', 'GABRIEL HENRIQUE DA SILVA SANTOS', 'gabriel.santos1@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55018990', 'GUILHERME JUAN DOUETTS', 'guilherme.douetts@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55012528', 'JOAO LUCAS COSTA DO CARMO', 'joao.carmo@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55020162', 'RODRIGO DE OLIVEIRA MACHADO', 'rodrigo.machado@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55019331', 'GUILHERME GONÇALVES MURCA', 'guilherme.murca@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55011402', 'ALAN BATISTA BARBOSA BARROS', 'alan.barros@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55011011', 'SIDNEI SANTOS POLICARPO', 'sidnei.policarpo@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G11', 0, 1),
('55007503', 'ARQUIMEDES PIRES DA SILVA', 'arquimedes.silva@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55015408', 'ALBENES SILVA CHAGAS', 'albenes.chagas@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55008491', 'MARCELO SEIJI HIRATSUKA', 'marcelo.hiratsuka@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55018920', 'BRUNO FERREIRA CORREIA DE SOUZA', 'bruno.souza2@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55019205', 'REGINALDO TAVARES FERREIRA', 'reginaldo.ferreira@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55011293', 'ANDERSON VINICIUS DO NASCIMENTO', 'anderson.nascimento@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55012716', 'DENIS CAMPOS ALVES LUIZ COSTA', 'denis.costa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55003302', 'RONALDO LOPES DA COSTA', 'ronaldo.costa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55010003', 'SERGIO DA SILVA SOUZA', 'sergio.souza@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55016366', 'VINICIUS BARBOSA BALTAZAR DA SILVA', 'vinicius.silva@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G06', 0, 1),
('55007943', 'CARLOS FELIPE DA SILVA LEMOS', 'carlos.lemos@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55006730', 'GILVAN JOAQUIM DE SOUSA', 'gilvan.sousa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55014054', 'ISMAEL GONCALVES DOS SANTOS', 'ismael.santos2@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55012050', 'JEFFERSON BARBOSA GRIGORIO', 'jefferson.grigorio@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55013973', 'JEFFERSON SOUZA MARQUES', 'jefferson.marques@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55020622', 'EMERSON DA SILVA NASCIMENTO IKEDA', 'emerson.ikeda@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55002462', 'FERNANDO DE MENDONCA COSTA', 'fernando.costa@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55018175', 'GABRIEL NASCIMENTO DE OLIVEIRA', 'gabriel.oliveira@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1),
('55010811', 'RODRIGO ALVES DA SILVA', 'rodrigo.silva3@tkelevator.com', '$2b$10$lPjOSXnA8CF1F7RjTd7OY.4w5FwMNgtfpnL6PrGvTXNzUYHDUCRy6', 'TECNICO', 'G05', 0, 1);
`;

// Inicializador assíncrono do sql.js
export async function initDatabase() {
  try {
    const wasmBinary = getSqlWasmBinary();
    const SQL = wasmBinary ? await initSqlJs({ wasmBinary }) : await initSqlJs();

    // No Vercel, copia banco existente para /tmp se existir
    if (isVercel && !fs.existsSync(dbPath)) {
      const candidates = [
        path.join(process.cwd(), 'database', 'database.sqlite'),
        path.resolve(__dirname, '../../database', 'database.sqlite'),
        path.resolve(__dirname, '../database', 'database.sqlite'),
        path.resolve(__dirname, 'database.sqlite'),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          try {
            fs.copyFileSync(cand, dbPath);
            console.log('📦 [Database] Banco de dados copiado para /tmp a partir de:', cand);
            break;
          } catch (e) {
            console.warn('⚠️ [Database] Aviso ao copiar banco original para /tmp:', e.message);
          }
        }
      }
    }

    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        sqlDb = new SQL.Database(fileBuffer);
        console.log('📦 [Database] Banco de dados SQLite carregado do disco com sucesso.');
      } catch (err) {
        console.warn('⚠️ [Database] Erro ao ler dbPath, criando novo banco em memória:', err.message);
        sqlDb = new SQL.Database();
      }
    } else {
      sqlDb = new SQL.Database();
      console.log('🆕 [Database] Novo banco de dados SQLite inicializado na memória.');
    }

    // Executa schema DDL (de arquivo ou embutido)
    let schemaSql = EMBEDDED_SCHEMA_SQL;
    const schemaPath = path.join(dbDirectory, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      try {
        schemaSql = fs.readFileSync(schemaPath, 'utf8');
      } catch (e) {
        // Fallback para embutido
      }
    }
    sqlDb.run(schemaSql);
    console.log('✅ [Database] Tabelas do banco de dados verificadas/criadas.');

    // Migrações dinâmicas de segurança para bancos legados
    const safeMigrations = [
      'ALTER TABLE chamados_orcamentos ADD COLUMN descricao_servico TEXT;',
      "ALTER TABLE tecnicos ADD COLUMN funcao VARCHAR(80) DEFAULT 'Técnico de Manutenção';",
      "ALTER TABLE chamados_orcamentos ADD COLUMN g_origem VARCHAR(10) DEFAULT 'G11';",
      "ALTER TABLE chamados_orcamentos ADD COLUMN valor_total REAL DEFAULT 0.00;",
      "ALTER TABLE usuarios ADD COLUMN primeiro_acesso INTEGER DEFAULT 0;",
      "ALTER TABLE usuarios ADD COLUMN grupo VARCHAR(10) DEFAULT 'G11';"
    ];

    for (const sqlMig of safeMigrations) {
      try {
        sqlDb.run(sqlMig);
      } catch (e) {
        // Coluna já existente
      }
    }

    // Verifica se já existem usuários; caso contrário, executa seeds
    const resUsr = sqlDb.exec('SELECT COUNT(*) as count FROM usuarios');
    const userCount = resUsr.length > 0 && resUsr[0].values.length > 0 ? resUsr[0].values[0][0] : 0;

    if (userCount === 0) {
      let seedSql = EMBEDDED_SEED_SQL;
      const seedPath = path.join(dbDirectory, 'seed.sql');
      if (fs.existsSync(seedPath)) {
        try {
          seedSql = fs.readFileSync(seedPath, 'utf8');
        } catch (e) {
          // Fallback para embutido
        }
      }
      sqlDb.run(seedSql);
      console.log('🌱 [Database] Seeds iniciais inseridos com sucesso.');
    }

    saveDatabase();
    return db;
  } catch (error) {
    console.error('❌ [Database] Erro crítico na inicialização do banco de dados:', error);
    throw error;
  }
}

// Wrapper intuitivo compatível com APIs padrão SQLite
export const db = {
  prepare(sql) {
    if (!sqlDb) {
      throw new Error('Banco de dados SQLite não foi inicializado. sqlDb está nulo.');
    }
    return {
      get(...params) {
        const stmt = sqlDb.prepare(sql);
        try {
          const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          stmt.bind(bindParams);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return null;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const stmt = sqlDb.prepare(sql);
        const rows = [];
        try {
          const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          stmt.bind(bindParams);
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        sqlDb.run(sql, bindParams);
        const lastIdRes = sqlDb.exec('SELECT last_insert_rowid() as id, changes() as changes');
        const lastInsertRowid = lastIdRes[0]?.values[0]?.[0] || 0;
        const changes = lastIdRes[0]?.values[0]?.[1] || 0;
        saveDatabase();
        
        return { lastInsertRowid, changes };
      }
    };
  },
  exec(sql) {
    if (!sqlDb) {
      throw new Error('Banco de dados SQLite não foi inicializado. sqlDb está nulo.');
    }
    const result = sqlDb.exec(sql);
    saveDatabase();
    return result;
  },
  getRawDb() {
    return sqlDb;
  }
};

export default db;
