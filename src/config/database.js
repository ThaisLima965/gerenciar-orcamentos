import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

const dbDirectory = path.resolve(__dirname, '../../database');
try {
  if (!fs.existsSync(dbDirectory) && !isServerless) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
} catch (e) {
  // Ignora se o diretório não puder ser criado em ambiente de somente leitura
}

// Procura caminhos possíveis para o banco de dados SQLite
function resolveDbPath() {
  if (isServerless && fs.existsSync('/tmp/database.sqlite')) {
    return '/tmp/database.sqlite';
  }
  const candidates = [
    process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : null,
    path.join(process.cwd(), 'database/database.sqlite'),
    path.join(dbDirectory, 'database.sqlite'),
    path.resolve(__dirname, '../../database/database.sqlite')
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return path.join(dbDirectory, 'database.sqlite');
}

let dbPath = resolveDbPath();
let sqlDb = null;
let initPromise = null;

// Função resiliente para persistir o banco de dados em disco
export function saveDatabase() {
  if (sqlDb) {
    try {
      const data = sqlDb.export();
      const buffer = Buffer.from(data);
      if (isServerless) {
        fs.writeFileSync('/tmp/database.sqlite', buffer);
      } else {
        fs.writeFileSync(dbPath, buffer);
      }
    } catch (err) {
      console.warn('⚠️ [Database] Aviso ao salvar banco de dados em disco:', err.message);
    }
  }
}

// Carrega o motor SQLite: tenta carregar WebAssembly e, se falhar, usa fallback 100% JavaScript (sql-asm.js)
async function getSqlInstance() {
  // 1. Tenta carregar sql-wasm com binário direto
  try {
    const wasmPaths = [
      path.join(process.cwd(), 'database/sql-wasm.wasm'),
      path.join(dbDirectory, 'sql-wasm.wasm'),
      path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
    ];
    let wasmBinary = null;
    for (const wp of wasmPaths) {
      if (fs.existsSync(wp)) {
        try {
          wasmBinary = fs.readFileSync(wp);
          break;
        } catch {}
      }
    }

    if (wasmBinary) {
      return await initSqlJs({ wasmBinary });
    }

    return await initSqlJs({
      locateFile: file => {
        for (const wp of wasmPaths) {
          if (fs.existsSync(wp)) return wp;
        }
        return file;
      }
    });
  } catch (wasmErr) {
    console.warn('⚠️ [Database] WebAssembly falhou, acionando fallback puro JavaScript (sql-asm):', wasmErr.message);
  }

  // 2. Fallback garantido: sql-asm (100% puro JavaScript, nunca falha por falta de .wasm)
  try {
    const { default: initSqlAsm } = await import('sql.js/dist/sql-asm.js');
    return await initSqlAsm();
  } catch (asmErr) {
    console.error('❌ [Database] Falha no fallback sql-asm:', asmErr.message);
    throw asmErr;
  }
}

// DDL essencial garantido mesmo que os arquivos externos não sejam encontrados
const ESSENTIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    matricula VARCHAR(30) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL CHECK(perfil IN ('TECNICO', 'SUPERVISOR', 'CONSULTORA')),
    grupo VARCHAR(10) NOT NULL DEFAULT 'G11',
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
    tipo_servico VARCHAR(20) NOT NULL,
    numero_pgo VARCHAR(50) NOT NULL,
    g_origem VARCHAR(10) NOT NULL DEFAULT 'G11',
    numero_contrato VARCHAR(50) NOT NULL,
    nome_cliente VARCHAR(150) NOT NULL,
    numero_orcamento VARCHAR(50) NOT NULL DEFAULT 'Aguardando Orçamento',
    descricao_servico TEXT,
    data_liberacao DATE,
    geor_liberou VARCHAR(10) NOT NULL DEFAULT 'Não',
    data_envio_cliente DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Aberto',
    valor_total REAL NOT NULL DEFAULT 0.00,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens_redefinicao_senha (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email VARCHAR(120) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    otp_code VARCHAR(10),
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens_redefinicao_senha(token);
CREATE INDEX IF NOT EXISTS idx_tokens_email_otp ON tokens_redefinicao_senha(email, otp_code);
CREATE INDEX IF NOT EXISTS idx_chamados_matricula ON chamados_orcamentos(matricula_tecnico);
CREATE INDEX IF NOT EXISTS idx_chamados_contrato ON chamados_orcamentos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios(matricula);
`;

// Inicializador assíncrono idempotente do SQLite
export async function initDatabase() {
  if (sqlDb) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const SQL = await getSqlInstance();
      dbPath = resolveDbPath();

      if (fs.existsSync(dbPath)) {
        try {
          const fileBuffer = fs.readFileSync(dbPath);
          sqlDb = new SQL.Database(fileBuffer);
          console.log(`📦 [Database] Banco de dados SQLite carregado com sucesso (${dbPath}).`);
        } catch (loadErr) {
          console.warn('⚠️ [Database] Falha ao ler arquivo de banco existente, criando novo na memória:', loadErr.message);
          sqlDb = new SQL.Database();
        }
      } else {
        sqlDb = new SQL.Database();
        console.log('🆕 [Database] Novo banco de dados SQLite inicializado na memória.');
      }

      // Aplica DDL essencial
      sqlDb.run(ESSENTIAL_SCHEMA_SQL);

      // Tenta ler schema.sql se disponível
      const schemaCandidate = [
        path.join(dbDirectory, 'schema.sql'),
        path.resolve(process.cwd(), 'database/schema.sql')
      ].find(p => fs.existsSync(p));

      if (schemaCandidate) {
        try {
          const schemaSql = fs.readFileSync(schemaCandidate, 'utf8');
          sqlDb.run(schemaSql);
        } catch (e) {
          console.warn('⚠️ [Database] Aviso ao aplicar schema.sql:', e.message);
        }
      }

      // Migrações dinâmicas de colunas adicionais
      const safeMigrations = [
        'ALTER TABLE chamados_orcamentos ADD COLUMN descricao_servico TEXT;',
        "ALTER TABLE tecnicos ADD COLUMN funcao VARCHAR(80) DEFAULT 'Técnico de Manutenção';",
        "ALTER TABLE chamados_orcamentos ADD COLUMN g_origem VARCHAR(10) DEFAULT 'G11';",
        'ALTER TABLE chamados_orcamentos ADD COLUMN valor_total REAL DEFAULT 0.00;',
        'ALTER TABLE usuarios ADD COLUMN primeiro_acesso INTEGER DEFAULT 0;',
        "ALTER TABLE usuarios ADD COLUMN grupo VARCHAR(10) DEFAULT 'G11';"
      ];

      for (const mig of safeMigrations) {
        try {
          sqlDb.run(mig);
        } catch {}
      }

      // Garante a existência de usuários padrão corporativos
      const resUsr = sqlDb.exec('SELECT COUNT(*) as count FROM usuarios');
      const userCount = resUsr.length > 0 && resUsr[0].values.length > 0 ? resUsr[0].values[0][0] : 0;

      if (userCount === 0) {
        sqlDb.run(`
          INSERT OR REPLACE INTO usuarios (id, nome, email, matricula, senha_hash, perfil, ativo, primeiro_acesso, grupo) VALUES
          (1, 'Thaís Lima (Consultora Admin)', 'thais.lima@tkelevator.com', '55011190', '$2b$10$WW7UyfZ75sbEKJqZKihV/OpCaB15qPt4NSiIojyxrh8qeuWnzVpn6', 'CONSULTORA', 1, 0, 'G11'),
          (2, 'Camila Mendes (Consultora Admin)', 'consultora@empresa.com', 'CONS001', '$2b$10$WW7UyfZ75sbEKJqZKihV/OpCaB15qPt4NSiIojyxrh8qeuWnzVpn6', 'CONSULTORA', 1, 0, 'G11'),
          (3, 'Carlos Albuquerque (Supervisor)', 'supervisor@empresa.com', 'SUP001', '$2b$10$WW7UyfZ75sbEKJqZKihV/OpCaB15qPt4NSiIojyxrh8qeuWnzVpn6', 'SUPERVISOR', 1, 0, 'G11'),
          (4, 'Thiago Silva (Técnico 1001)', 'tecnico@empresa.com', '1001', '$2b$10$WW7UyfZ75sbEKJqZKihV/OpCaB15qPt4NSiIojyxrh8qeuWnzVpn6', 'TECNICO', 1, 0, 'G11');
        `);
        console.log('👑 [Database] Usuários corporativos padrão inicializados com sucesso.');
      } else {
        // Garante que Thaís Lima exista mesmo em bases já existentes
        try {
          const thaisCheck = sqlDb.exec("SELECT id FROM usuarios WHERE LOWER(email) = 'thais.lima@tkelevator.com'");
          if (!thaisCheck.length || !thaisCheck[0].values.length) {
            sqlDb.run(`
              INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, ativo, primeiro_acesso, grupo)
              VALUES ('Thaís Lima (Consultora Admin)', 'thais.lima@tkelevator.com', '55011190', '$2b$10$WW7UyfZ75sbEKJqZKihV/OpCaB15qPt4NSiIojyxrh8qeuWnzVpn6', 'CONSULTORA', 1, 0, 'G11');
            `);
          }
        } catch {}
      }

      saveDatabase();
      return db;
    } catch (error) {
      console.error('❌ [Database] Erro crítico na inicialização do banco de dados:', error);
      throw error;
    }
  })();

  return initPromise;
}

// Wrapper intuitivo compatível com APIs padrão SQLite
export const db = {
  prepare(sql) {
    return {
      get(...params) {
        if (!sqlDb) {
          throw new Error('Banco de dados SQLite ainda não inicializado.');
        }
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
        if (!sqlDb) {
          throw new Error('Banco de dados SQLite ainda não inicializado.');
        }
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
        if (!sqlDb) {
          throw new Error('Banco de dados SQLite ainda não inicializado.');
        }
        const bindParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        sqlDb.run(sql, bindParams);
        let lastInsertRowid = 0;
        let changes = 0;
        try {
          const lastIdRes = sqlDb.exec('SELECT last_insert_rowid() as id, changes() as changes');
          lastInsertRowid = lastIdRes[0]?.values[0]?.[0] || 0;
          changes = lastIdRes[0]?.values[0]?.[1] || 0;
        } catch {}
        saveDatabase();
        return { lastInsertRowid, changes };
      }
    };
  },
  exec(sql) {
    if (!sqlDb) {
      throw new Error('Banco de dados SQLite ainda não inicializado.');
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
