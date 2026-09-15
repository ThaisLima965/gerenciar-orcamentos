import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const dbDirectory = path.resolve(__dirname, '../../database');

if (!isVercel && !fs.existsSync(dbDirectory)) {
  try {
    fs.mkdirSync(dbDirectory, { recursive: true });
  } catch (e) {
    // Silencia se não conseguir criar pasta
  }
}

const dbPath = process.env.DB_PATH 
  ? path.resolve(process.cwd(), process.env.DB_PATH) 
  : (isVercel ? path.join('/tmp', 'database.sqlite') : path.join(dbDirectory, 'database.sqlite'));

let sqlDb = null;

// Função para persistir o banco de dados em disco
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

// Inicializador assíncrono do sql.js
export async function initDatabase() {
  try {
    const SQL = await initSqlJs();

    const originalSeedDbPath = path.join(dbDirectory, 'database.sqlite');
    if (isVercel && !fs.existsSync(dbPath) && fs.existsSync(originalSeedDbPath)) {
      try {
        fs.copyFileSync(originalSeedDbPath, dbPath);
      } catch (e) {
        console.warn('⚠️ [Database] Não foi possível copiar banco original para /tmp:', e.message);
      }
    }

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
      console.log('📦 [Database] Banco de dados SQLite carregado do disco com sucesso.');
    } else {
      sqlDb = new SQL.Database();
      console.log('🆕 [Database] Novo banco de dados SQLite inicializado na memória.');
    }

    // Executa schema DDL
    const schemaPath = path.join(dbDirectory, 'schema.sql');
    const seedPath = path.join(dbDirectory, 'seed.sql');

    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      sqlDb.run(schemaSql);
      console.log('✅ [Database] Tabelas do banco de dados verificadas/criadas.');
    }

    // Garante migração da coluna descricao_servico caso o banco já exista
    try {
      sqlDb.run('ALTER TABLE chamados_orcamentos ADD COLUMN descricao_servico TEXT;');
    } catch (e) {
      // Coluna já existe
    }

    // Garante migração da coluna funcao na tabela tecnicos
    try {
      sqlDb.run("ALTER TABLE tecnicos ADD COLUMN funcao VARCHAR(80) DEFAULT 'Técnico de Manutenção';");
    } catch (e) {
      // Coluna já existe
    }

    // Garante migração da coluna g_origem na tabela chamados_orcamentos
    try {
      sqlDb.run("ALTER TABLE chamados_orcamentos ADD COLUMN g_origem VARCHAR(10) DEFAULT 'G11';");
    } catch (e) {
      // Coluna já existe
    }

    // Garante migração da coluna valor_total na tabela chamados_orcamentos
    try {
      sqlDb.run("ALTER TABLE chamados_orcamentos ADD COLUMN valor_total REAL DEFAULT 0.00;");
    } catch (e) {
      // Coluna já existe
    }

    // Garante migração da coluna primeiro_acesso na tabela usuarios
    try {
      sqlDb.run("ALTER TABLE usuarios ADD COLUMN primeiro_acesso INTEGER DEFAULT 0;");
    } catch (e) {
      // Coluna já existe
    }

    // Garante migração da coluna grupo na tabela usuarios
    try {
      sqlDb.run("ALTER TABLE usuarios ADD COLUMN grupo VARCHAR(10) DEFAULT 'G11';");
    } catch (e) {
      // Coluna já existe
    }

    // Verifica se já existem usuários e clientes; caso contrário, executa seeds
    const resUsr = sqlDb.exec('SELECT COUNT(*) as count FROM usuarios');
    const userCount = resUsr.length > 0 && resUsr[0].values.length > 0 ? resUsr[0].values[0][0] : 0;

    const resCli = sqlDb.exec('SELECT COUNT(*) as count FROM clientes');
    const clientCount = resCli.length > 0 && resCli[0].values.length > 0 ? resCli[0].values[0][0] : 0;

    if ((userCount === 0 || clientCount === 0) && fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      sqlDb.run(seedSql);
      console.log('🌱 [Database] Seeds iniciais de Clientes, Técnicos, Usuários e Orçamentos inseridos.');
    }

    saveDatabase();
    return db;
  } catch (error) {
    console.error('❌ [Database] Erro na inicialização do banco de dados:', error);
    throw error;
  }
}

// Wrapper intuitivo compatível com APIs padrão SQLite
export const db = {
  prepare(sql) {
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
    const result = sqlDb.exec(sql);
    saveDatabase();
    return result;
  },
  getRawDb() {
    return sqlDb;
  }
};

export default db;
