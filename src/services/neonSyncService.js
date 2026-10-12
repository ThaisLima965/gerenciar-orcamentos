import pg from 'pg';
import dotenv from 'dotenv';
import { db, saveDatabase } from '../config/database.js';
import { sanitizeUtf8, normalizeTecnicoFuncao } from '../utils/encodingUtils.js';

dotenv.config();

const { Pool } = pg;

let pool = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
}

function getPool() {
  const dbUrl = getDatabaseUrl();
  if (!pool && dbUrl) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000
    });

    pool.on('error', (err) => {
      console.warn('⚠️ [NeonSyncService] Aviso no pool PostgreSQL:', err.message);
    });
  }
  return pool;
}

async function queryNeon(text, params = []) {
  const p = getPool();
  if (!p) throw new Error('Neon Pool não configurado.');
  try {
    return await p.query(text, params);
  } catch (err) {
    const isConnErr = err.message && (
      err.message.includes('Connection terminated') ||
      err.message.includes('timeout') ||
      err.message.includes('ECONNRESET') ||
      err.message.includes('closed')
    );
    if (isConnErr) {
      await new Promise((r) => setTimeout(r, 800));
      return await p.query(text, params);
    }
    throw err;
  }
}

let lastNeonVersion = '';
let isSyncingFromNeon = false;

export const neonSyncService = {
  get isConfigured() {
    return Boolean(getDatabaseUrl());
  },

  /**
   * Sincroniza dados do Neon PostgreSQL para o SQLite local (Downstream)
   * Garante que edições feitas diretamente no Neon apareçam instantaneamente no sistema
   */
  async syncFromNeon(force = false) {
    if (!this.isConfigured) return { success: false, reason: 'skip' };

    if (isSyncingFromNeon) {
      if (!force) return { success: false, reason: 'already_syncing' };
      let waitTime = 0;
      while (isSyncingFromNeon && waitTime < 10000) {
        await new Promise((r) => setTimeout(r, 200));
        waitTime += 200;
      }
    }

    if (!getPool()) return { success: false, reason: 'no_pool' };

    isSyncingFromNeon = true;
    try {
      // 1. Chamados / Orçamentos
      const orcRes = await queryNeon(`
        SELECT 
          id, matricula_tecnico, nome_tecnico, tipo_servico, numero_pgo, 
          COALESCE(g_origem, 'G11') as g_origem, numero_contrato, nome_cliente,
          numero_orcamento, descricao_servico, COALESCE(valor_total, 0.00)::float as valor_total,
          to_char(data_liberacao, 'YYYY-MM-DD') as data_liberacao,
          geor_liberou,
          to_char(data_envio_cliente, 'YYYY-MM-DD') as data_envio_cliente,
          status, data_criacao, created_by_id, updated_at
        FROM chamados_orcamentos
        ORDER BY id ASC
      `);

      if (orcRes.rows && orcRes.rows.length === 0) {
        // Se a tabela no Neon está limpa/vazia para nova importação oficial, garante SQLite também vazio
        const localOrcs = db.prepare('SELECT COUNT(*) as count FROM chamados_orcamentos').get()?.count || 0;
        if (localOrcs > 0) {
          db.prepare('DELETE FROM chamados_orcamentos').run();
        }
      } else if (orcRes.rows && orcRes.rows.length > 0) {
        const stmtOrc = db.prepare(`
          INSERT OR REPLACE INTO chamados_orcamentos (
            id, matricula_tecnico, nome_tecnico, tipo_servico, numero_pgo,
            g_origem, numero_contrato, nome_cliente, numero_orcamento, descricao_servico,
            valor_total, data_liberacao, geor_liberou, data_envio_cliente, status,
            data_criacao, created_by_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of orcRes.rows) {
          try {
            stmtOrc.run(
              row.id,
              row.matricula_tecnico,
              sanitizeUtf8(row.nome_tecnico),
              row.tipo_servico,
              row.numero_pgo,
              row.g_origem || 'G11',
              row.numero_contrato,
              sanitizeUtf8(row.nome_cliente),
              row.numero_orcamento || 'Aguardando Orçamento',
              sanitizeUtf8(row.descricao_servico),
              Number(row.valor_total) || 0.00,
              row.data_liberacao,
              row.geor_liberou || 'Não',
              row.data_envio_cliente,
              row.status || 'Aberto',
              row.data_criacao ? new Date(row.data_criacao).toISOString() : new Date().toISOString(),
              row.created_by_id,
              row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
            );
          } catch (e) {
            // Ignora erro em linha individual
          }
        }
      }

      // 2. Clientes
      const cliRes = await queryNeon('SELECT numero_contrato, nome_cliente, created_at FROM clientes ORDER BY numero_contrato ASC');
      if (cliRes.rows && cliRes.rows.length > 0) {
        const stmtCli = db.prepare('INSERT OR REPLACE INTO clientes (numero_contrato, nome_cliente, created_at) VALUES (?, ?, ?)');
        for (const c of cliRes.rows) {
          try {
            stmtCli.run(c.numero_contrato, sanitizeUtf8(c.nome_cliente), c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString());
          } catch {}
        }
      }

      // 3. Técnicos (padronizado com os 3 níveis oficiais e UTF-8 higienizado)
      const tecRes = await queryNeon('SELECT matricula, funcao, nome_sobrenome, email, telefone, created_at FROM tecnicos ORDER BY matricula ASC');
      if (tecRes.rows && tecRes.rows.length > 0) {
        const stmtTec = db.prepare('INSERT OR REPLACE INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        for (const t of tecRes.rows) {
          try {
            stmtTec.run(
              t.matricula, 
              normalizeTecnicoFuncao(t.funcao), 
              sanitizeUtf8(t.nome_sobrenome), 
              t.email ? sanitizeUtf8(t.email) : null, 
              t.telefone, 
              t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString()
            );
          } catch {}
        }
      }

      // 4. Usuários
      const usrRes = await queryNeon('SELECT id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo, created_at, updated_at FROM usuarios ORDER BY id ASC');
      if (usrRes.rows && usrRes.rows.length > 0) {
        const stmtUsr = db.prepare('INSERT OR REPLACE INTO usuarios (id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const u of usrRes.rows) {
          try {
            stmtUsr.run(
              u.id, 
              sanitizeUtf8(u.nome), 
              u.email ? sanitizeUtf8(u.email) : null, 
              u.matricula, 
              u.senha_hash, 
              u.perfil, 
              u.grupo || 'G11', 
              u.primeiro_acesso ?? 0, 
              u.ativo ?? 1, 
              u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(), 
              u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString()
            );
          } catch {}
        }
      }

      saveDatabase();
      return { success: true, orcamentos: orcRes.rows.length, clientes: cliRes.rows.length, tecnicos: tecRes.rows.length };
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao sincronizar dados do Neon:', err.message);
      return { success: false, error: err.message };
    } finally {
      isSyncingFromNeon = false;
    }
  },

  /**
   * Obtém a versão de estado atual do Neon (para detecção em tempo real de mudanças)
   */
  async getNeonStatus() {
    if (!this.isConfigured) {
      // Fallback local caso DATABASE_URL não esteja ativo
      const orcStat = db.prepare('SELECT COUNT(*) as count, MAX(updated_at) as updated_at FROM chamados_orcamentos').get() || {};
      const cliCount = db.prepare('SELECT COUNT(*) as count FROM clientes').get()?.count || 0;
      const tecCount = db.prepare('SELECT COUNT(*) as count FROM tecnicos').get()?.count || 0;
      const usrCount = db.prepare('SELECT COUNT(*) as count FROM usuarios').get()?.count || 0;
      const version = `${orcStat.count}-${orcStat.updated_at || ''}-${cliCount}-${tecCount}-${usrCount}`;
      return { success: true, isNeon: false, version, counts: { orcamentos: orcStat.count, clientes: cliCount, tecnicos: tecCount, usuarios: usrCount } };
    }

    if (!getPool()) return { success: false, error: 'no_pool' };

    try {
      const res = await queryNeon(`
        SELECT 
          (SELECT COUNT(*) FROM chamados_orcamentos) as orc_count,
          (SELECT to_char(MAX(updated_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM chamados_orcamentos) as orc_updated,
          (SELECT COUNT(*) FROM clientes) as cli_count,
          (SELECT COUNT(*) FROM tecnicos) as tec_count,
          (SELECT COUNT(*) FROM usuarios) as usr_count
      `);

      const row = res.rows[0] || {};
      const version = `${row.orc_count}-${row.orc_updated || ''}-${row.cli_count}-${row.tec_count}-${row.usr_count}`;

      // Se a versão mudou em relação à última sincronização, roda sync em background
      if (lastNeonVersion && version !== lastNeonVersion) {
        lastNeonVersion = version;
        this.syncFromNeon().catch(() => {});
      } else {
        lastNeonVersion = version;
      }

      return {
        success: true,
        isNeon: true,
        version,
        counts: {
          orcamentos: Number(row.orc_count) || 0,
          clientes: Number(row.cli_count) || 0,
          tecnicos: Number(row.tec_count) || 0,
          usuarios: Number(row.usr_count) || 0
        },
        orcamentos_updated_at: row.orc_updated
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Envia atualização de Orçamento diretamente para o Neon (Upstream)
   */
  async syncOrcamentoToNeon(orc) {
    if (!this.isConfigured || !orc) return;
    if (!getPool()) return;

    try {
      await queryNeon(`
        INSERT INTO chamados_orcamentos (
          matricula_tecnico, nome_tecnico, tipo_servico, numero_pgo,
          g_origem, numero_contrato, nome_cliente, numero_orcamento,
          descricao_servico, valor_total, data_liberacao, geor_liberou,
          data_envio_cliente, status, created_by_id, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP
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
          valor_total = EXCLUDED.valor_total,
          data_liberacao = EXCLUDED.data_liberacao,
          geor_liberou = EXCLUDED.geor_liberou,
          data_envio_cliente = EXCLUDED.data_envio_cliente,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        orc.matricula_tecnico,
        orc.nome_tecnico,
        orc.tipo_servico,
        orc.numero_pgo,
        orc.g_origem || 'G11',
        orc.numero_contrato,
        orc.nome_cliente,
        orc.numero_orcamento || 'Aguardando Orçamento',
        orc.descricao_servico || null,
        Number(orc.valor_total) || 0.00,
        orc.data_liberacao || null,
        orc.geor_liberou || 'Não',
        orc.data_envio_cliente || null,
        orc.status || 'Aberto',
        orc.created_by_id || null
      ]);
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao sincronizar orçamento no Neon:', err.message);
    }
  },

  /**
   * Exclui Orçamento diretamente no Neon
   */
  async deleteOrcamentoFromNeon(id, numero_pgo = null) {
    if (!this.isConfigured) return;
    if (!getPool()) return;

    try {
      if (numero_pgo) {
        await queryNeon('DELETE FROM chamados_orcamentos WHERE numero_pgo = $1 OR id = $2', [numero_pgo, id]);
      } else {
        await queryNeon('DELETE FROM chamados_orcamentos WHERE id = $1', [id]);
      }
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao excluir orçamento no Neon:', err.message);
    }
  },

  /**
   * Envia atualização de Cliente diretamente para o Neon
   */
  async syncClienteToNeon(cli) {
    if (!this.isConfigured || !cli) return;
    if (!getPool()) return;

    try {
      await queryNeon(`
        INSERT INTO clientes (numero_contrato, nome_cliente, created_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (numero_contrato) DO UPDATE SET
          nome_cliente = EXCLUDED.nome_cliente
      `, [cli.numero_contrato, cli.nome_cliente]);
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao sincronizar cliente no Neon:', err.message);
    }
  },

  /**
   * Exclui Cliente diretamente no Neon
   */
  async deleteClienteFromNeon(numero_contrato) {
    if (!this.isConfigured) return;
    if (!getPool()) return;

    try {
      await queryNeon('DELETE FROM clientes WHERE numero_contrato = $1', [numero_contrato]);
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao excluir cliente no Neon:', err.message);
    }
  },

  /**
   * Limpa a tabela chamados_orcamentos no Neon PostgreSQL
   */
  async clearOrcamentosInNeon() {
    if (!this.isConfigured) return;
    if (!getPool()) return;

    try {
      await queryNeon('DELETE FROM chamados_orcamentos');
      console.log('🧹 [NeonSyncService] Tabela chamados_orcamentos limpa no Neon com sucesso.');
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao limpar orçamentos no Neon:', err.message);
    }
  },

  /**
   * Envia atualização de Técnico diretamente para o Neon
   */
  async syncTecnicoToNeon(tec) {
    if (!this.isConfigured || !tec) return;
    if (!getPool()) return;

    try {
      await queryNeon(`
        INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (matricula) DO UPDATE SET
          funcao = EXCLUDED.funcao,
          nome_sobrenome = EXCLUDED.nome_sobrenome,
          email = EXCLUDED.email,
          telefone = EXCLUDED.telefone
      `, [
        tec.matricula,
        normalizeTecnicoFuncao(tec.funcao),
        sanitizeUtf8(tec.nome_sobrenome || tec.nome_completo),
        tec.email ? sanitizeUtf8(tec.email) : null,
        tec.telefone || null
      ]);
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao sincronizar técnico no Neon:', err.message);
    }
  },

  /**
   * Exclui Técnico diretamente no Neon
   */
  async deleteTecnicoFromNeon(matricula) {
    if (!this.isConfigured) return;
    if (!getPool()) return;

    try {
      await queryNeon('DELETE FROM tecnicos WHERE matricula = $1', [matricula]);
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao excluir técnico no Neon:', err.message);
    }
  },

  /**
   * Envia atualização de Usuário diretamente para o Neon
   */
  async syncUsuarioToNeon(usr) {
    if (!this.isConfigured || !usr) return;
    if (!getPool()) return;

    try {
      await queryNeon(`
        INSERT INTO usuarios (
          nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
        )
        ON CONFLICT (email) DO UPDATE SET
          nome = EXCLUDED.nome,
          matricula = EXCLUDED.matricula,
          senha_hash = CASE WHEN EXCLUDED.senha_hash IS NOT NULL AND EXCLUDED.senha_hash != '' THEN EXCLUDED.senha_hash ELSE usuarios.senha_hash END,
          perfil = EXCLUDED.perfil,
          grupo = EXCLUDED.grupo,
          primeiro_acesso = EXCLUDED.primeiro_acesso,
          ativo = EXCLUDED.ativo,
          updated_at = CURRENT_TIMESTAMP
      `, [
        usr.nome,
        usr.email.toLowerCase().trim(),
        usr.matricula,
        usr.senha_hash || '',
        usr.perfil,
        usr.grupo || 'G11',
        usr.primeiro_acesso ?? 0,
        usr.ativo ?? 1
      ]);
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao sincronizar usuário no Neon:', err.message);
    }
  },

  /**
   * Exclui Usuário diretamente no Neon
   */
  async deleteUsuarioFromNeon(id, email = null) {
    if (!this.isConfigured) return;
    if (!getPool()) return;

    try {
      if (email) {
        await queryNeon('DELETE FROM usuarios WHERE email = $1 OR id = $2', [email.toLowerCase().trim(), id]);
      } else {
        await queryNeon('DELETE FROM usuarios WHERE id = $1', [id]);
      }
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha ao excluir usuário no Neon:', err.message);
    }
  },

  /**
   * Sincroniza lista em lote de orçamentos (utilizado na importação de planilhas)
   */
  async syncOrcamentosBatchToNeon(orcamentosList) {
    if (!this.isConfigured || !Array.isArray(orcamentosList) || orcamentosList.length === 0) return;
    const client = getPool();
    if (!client) return;

    try {
      for (const orc of orcamentosList) {
        await this.syncOrcamentoToNeon(orc);
      }
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha no lote de orçamentos para o Neon:', err.message);
    }
  },

  /**
   * Sincroniza lista em lote de clientes (utilizado na importação de planilhas)
   */
  async syncClientesBatchToNeon(clientesList) {
    if (!this.isConfigured || !Array.isArray(clientesList) || clientesList.length === 0) return;
    try {
      for (const cli of clientesList) {
        await this.syncClienteToNeon(cli);
      }
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha no lote de clientes para o Neon:', err.message);
    }
  },

  /**
   * Sincroniza lista em lote de técnicos (utilizado na importação de planilhas)
   */
  async syncTecnicosBatchToNeon(tecnicosList) {
    if (!this.isConfigured || !Array.isArray(tecnicosList) || tecnicosList.length === 0) return;
    try {
      for (const tec of tecnicosList) {
        await this.syncTecnicoToNeon(tec);
      }
    } catch (err) {
      console.warn('⚠️ [NeonSyncService] Falha no lote de técnicos para o Neon:', err.message);
    }
  }
};

export default neonSyncService;
