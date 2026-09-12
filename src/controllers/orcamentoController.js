import { db } from '../config/database.js';
import { PERMISSIONS } from '../middleware/rbac.js';

export const orcamentoController = {
  // Listagem de Chamados e Orçamentos com filtros e métricas
  async list(req, res) {
    try {
      const { 
        q, 
        status, 
        tipo_servico, 
        g_origem,
        geor_liberou, 
        matricula_tecnico,
        numero_contrato 
      } = req.query;

      let query = `
        SELECT 
          id, 
          matricula_tecnico, 
          nome_tecnico, 
          tipo_servico, 
          numero_pgo, 
          g_origem,
          numero_contrato, 
          nome_cliente, 
          numero_orcamento, 
          descricao_servico,
          valor_total,
          data_liberacao, 
          geor_liberou, 
          data_envio_cliente, 
          status, 
          data_criacao,
          created_by_id,
          updated_at
        FROM chamados_orcamentos
        WHERE 1=1
      `;
      const params = [];

      if (q) {
        query += ` AND (
          numero_pgo LIKE ? OR 
          numero_orcamento LIKE ? OR 
          descricao_servico LIKE ? OR
          nome_cliente LIKE ? OR 
          nome_tecnico LIKE ? OR 
          numero_contrato LIKE ?
        )`;
        const searchParam = `%${q}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
      }

      if (status) {
        query += ` AND status = ?`;
        params.push(status);
      }

      if (tipo_servico) {
        query += ` AND tipo_servico = ?`;
        params.push(tipo_servico);
      }

      if (g_origem) {
        query += ` AND g_origem = ?`;
        params.push(g_origem);
      }

      if (geor_liberou) {
        query += ` AND geor_liberou = ?`;
        params.push(geor_liberou);
      }

      if (matricula_tecnico) {
        query += ` AND matricula_tecnico = ?`;
        params.push(matricula_tecnico);
      }

      if (numero_contrato) {
        query += ` AND numero_contrato = ?`;
        params.push(numero_contrato);
      }

      query += ` ORDER BY id DESC`;

      const chamados = db.prepare(query).all(...params);

      // Métricas gerais para os KPIs do Dashboard
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN geor_liberou = 'Não' AND status != 'Cancelado' THEN 1 ELSE 0 END) as aguardando_geor,
          SUM(CASE WHEN geor_liberou = 'Sim' THEN 1 ELSE 0 END) as liberados_geor,
          SUM(CASE WHEN data_envio_cliente IS NOT NULL THEN 1 ELSE 0 END) as enviados_cliente,
          SUM(CASE WHEN status = 'Concluído' OR status = 'Aprovado pelo Cliente' THEN 1 ELSE 0 END) as concluidos
        FROM chamados_orcamentos
      `).get() || { total: 0, aguardando_geor: 0, liberados_geor: 0, enviados_cliente: 0, concluidos: 0 };

      return res.status(200).json({
        success: true,
        data: chamados,
        stats: {
          total: stats.total || 0,
          aguardando_geor: stats.aguardando_geor || 0,
          liberados_geor: stats.liberados_geor || 0,
          enviados_cliente: stats.enviados_cliente || 0,
          concluidos: stats.concluidos || 0
        },
        userRole: req.user.perfil
      });
    } catch (error) {
      console.error('❌ [Orcamento Controller] Erro ao listar chamados:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao consultar chamados e orçamentos.'
      });
    }
  },

  // Obter detalhes de um chamado específico
  async getById(req, res) {
    try {
      const { id } = req.params;
      const chamado = db.prepare('SELECT * FROM chamados_orcamentos WHERE id = ?').get(id);

      if (!chamado) {
        return res.status(404).json({
          success: false,
          error: 'Chamado / Orçamento não encontrado.'
        });
      }

      return res.status(200).json({
        success: true,
        data: chamado
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar detalhes do orçamento.'
      });
    }
  },

  // Criar novo chamado / orçamento
  async create(req, res) {
    try {
      const {
        matricula_tecnico,
        nome_tecnico,
        tipo_servico,
        numero_pgo,
        g_origem,
        numero_contrato,
        numero_elevador,
        nome_cliente,
        numero_orcamento,
        descricao_servico,
        valor_total,
        data_liberacao,
        geor_liberou,
        data_envio_cliente,
        status
      } = req.body;

      // Resolução do Valor Total
      const finalValorTotal = Number(valor_total) || 0.00;

      // Resolução do Contrato / Elevador
      const resolvedContrato = String(numero_elevador || numero_contrato || '').trim();

      // Validação de campos da Seção 1 (Obrigatórios para criação)
      if (!resolvedContrato || !tipo_servico) {
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios da Seção 1: Número do Elevador / Contrato e Tipo de Serviço.'
        });
      }

      // Validação do tipo de serviço
      if (!['Preventivo', 'Corretivo'].includes(tipo_servico)) {
        return res.status(400).json({
          success: false,
          error: 'Tipo de Serviço inválido. Use "Preventivo" ou "Corretivo".'
        });
      }

      // Validação do G de Origem (G11, G06, G05)
      const finalGOrigem = g_origem || 'G11';
      if (!['G11', 'G06', 'G05'].includes(finalGOrigem)) {
        return res.status(400).json({
          success: false,
          error: 'G de Origem inválido. Selecione uma das opções válidas: G11, G06 ou G05.'
        });
      }

      // Resolução automática do Cliente pelo Elevador/Contrato
      let resolvedNomeCliente = nome_cliente;
      const clienteFound = db.prepare('SELECT nome_cliente FROM clientes WHERE numero_contrato = ?').get(resolvedContrato);
      if (clienteFound) {
        resolvedNomeCliente = clienteFound.nome_cliente;
      } else if (!resolvedNomeCliente) {
        return res.status(400).json({
          success: false,
          error: `Cliente para o elevador/contrato "${resolvedContrato}" não foi localizado na base. Cadastre o cliente primeiro ou informe o nome.`
        });
      } else {
        // Cadastra cliente automaticamente se fornecido nome
        db.prepare('INSERT OR IGNORE INTO clientes (numero_contrato, nome_cliente) VALUES (?, ?)').run(resolvedContrato, resolvedNomeCliente);
      }

      // Resolução do Técnico
      let resolvedMatriculaTecnico = matricula_tecnico;
      let resolvedNomeTecnico = nome_tecnico;

      if (req.user.perfil === 'TECNICO') {
        // Se for técnico, associa compulsoriamente a matrícula e nome do próprio usuário autenticado
        resolvedMatriculaTecnico = req.user.matricula;
        resolvedNomeTecnico = req.user.nome;
      } else {
        if (!resolvedMatriculaTecnico) {
          return res.status(400).json({
            success: false,
            error: 'A matrícula do técnico responsável é obrigatória.'
          });
        }
        const tecnicoFound = db.prepare('SELECT nome_sobrenome FROM tecnicos WHERE matricula = ?').get(resolvedMatriculaTecnico);
        if (tecnicoFound) {
          resolvedNomeTecnico = tecnicoFound.nome_sobrenome;
        } else if (!resolvedNomeTecnico) {
          resolvedNomeTecnico = `Técnico ${resolvedMatriculaTecnico}`;
        }
      }

      // Gerador automático de PGO caso não fornecido
      const finalNumeroPgo = String(numero_pgo || '').trim() || `PGO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Regras de Seção 2 e Seção 3 por Perfil:
      let finalNumeroOrcamento = 'Aguardando Orçamento';
      let finalGeorLiberou = 'Não';
      let finalDataLiberacao = null;
      let finalDataEnvioCliente = null;
      let finalStatus = 'Aberto';

      if (req.user.perfil === 'SUPERVISOR') {
        // Supervisor pode preencher Seção 2
        finalNumeroOrcamento = String(numero_orcamento || 'Aguardando Orçamento').trim();
        finalGeorLiberou = geor_liberou === 'Sim' ? 'Sim' : 'Não';
        finalDataLiberacao = data_liberacao || (finalGeorLiberou === 'Sim' ? new Date().toISOString().split('T')[0] : null);
        finalStatus = finalGeorLiberou === 'Sim' ? 'Liberado GEOR' : 'Aguardando GEOR';
      } else if (req.user.perfil === 'CONSULTORA') {
        // Consultora tem controle total
        finalNumeroOrcamento = String(numero_orcamento || 'Aguardando Orçamento').trim();
        finalGeorLiberou = geor_liberou === 'Sim' ? 'Sim' : 'Não';
        finalDataLiberacao = data_liberacao || (finalGeorLiberou === 'Sim' ? new Date().toISOString().split('T')[0] : null);
        finalDataEnvioCliente = data_envio_cliente || null;
        finalStatus = status || (finalDataEnvioCliente ? 'Enviado ao Cliente' : (finalGeorLiberou === 'Sim' ? 'Liberado GEOR' : 'Aberto'));
      }

      const stmt = db.prepare(`
        INSERT INTO chamados_orcamentos (
          matricula_tecnico,
          nome_tecnico,
          tipo_servico,
          numero_pgo,
          g_origem,
          numero_contrato,
          nome_cliente,
          numero_orcamento,
          descricao_servico,
          valor_total,
          data_liberacao,
          geor_liberou,
          data_envio_cliente,
          status,
          created_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        resolvedMatriculaTecnico,
        resolvedNomeTecnico,
        tipo_servico,
        finalNumeroPgo,
        finalGOrigem,
        resolvedContrato,
        resolvedNomeCliente,
        finalNumeroOrcamento,
        descricao_servico || null,
        finalValorTotal,
        finalDataLiberacao,
        finalGeorLiberou,
        finalDataEnvioCliente,
        finalStatus,
        req.user.id
      );

      const novoOrcamento = db.prepare('SELECT * FROM chamados_orcamentos WHERE id = ?').get(result.lastInsertRowid);

      return res.status(201).json({
        success: true,
        message: 'Chamado / Orçamento cadastrado com sucesso.',
        data: novoOrcamento
      });
    } catch (error) {
      console.error('❌ [Orcamento Controller] Erro ao criar orçamento:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao salvar novo orçamento.'
      });
    }
  },

  // Atualizar orçamento existente (com regras estritas de permissão e bloqueio RBAC)
  async update(req, res) {
    try {
      const { id } = req.params;
      const current = db.prepare('SELECT * FROM chamados_orcamentos WHERE id = ?').get(id);

      if (!current) {
        return res.status(404).json({
          success: false,
          error: 'Orçamento não encontrado para atualização.'
        });
      }

      const isConsultora = req.user.perfil === 'CONSULTORA';
      const isSupervisor = req.user.perfil === 'SUPERVISOR';
      const isTecnico = req.user.perfil === 'TECNICO';

      // =====================================================================
      // REGRA 1: TÉCNICO -> REGISTRO É ESTRITAMENTE SOMENTE LEITURA APÓS SALVAR
      // =====================================================================
      if (isTecnico) {
        return res.status(403).json({
          success: false,
          error: 'Permissão negada. O registro é estritamente somente leitura para o técnico após a criação inicial.'
        });
      }

      const {
        matricula_tecnico,
        nome_tecnico,
        tipo_servico,
        numero_pgo,
        g_origem,
        numero_contrato,
        numero_elevador,
        nome_cliente,
        numero_orcamento,
        descricao_servico,
        valor_total,
        data_liberacao,
        geor_liberou,
        data_envio_cliente,
        status
      } = req.body;

      // =====================================================================
      // REGRA 2: SUPERVISOR -> APENAS SEÇÃO 2 (ORÇAMENTO, DATA LIBERAÇÃO, GEOR, VALOR)
      // Após salvar Seção 2 com GEOR Liberado, torna-se SOMENTE LEITURA.
      // Seção 1 e Seção 3 são estritamente bloqueadas para o Supervisor.
      // =====================================================================
      if (isSupervisor) {
        // Se o registro já foi concluído/salvo com GEOR liberado, bloqueia edição posterior
        if (current.geor_liberou === 'Sim') {
          return res.status(403).json({
            success: false,
            error: 'Permissão negada. A liberação GEOR deste chamado já foi salva e finalizada pela supervisão (Somente Leitura).'
          });
        }

        // Supervisor não pode alterar Seção 3 (Data de Envio ao Cliente, Status comercial e Valor do Orçamento)
        if (data_envio_cliente !== undefined && data_envio_cliente !== current.data_envio_cliente) {
          return res.status(403).json({
            success: false,
            error: 'Permissão negada. Apenas a Consultora (Admin) pode definir a Data de Envio ao Cliente.'
          });
        }

        if (valor_total !== undefined && Number(valor_total) !== Number(current.valor_total)) {
          return res.status(403).json({
            success: false,
            error: 'Permissão negada. O Valor Total do Orçamento é de responsabilidade exclusiva da Consultora (Admin).'
          });
        }

        // Seção 1 permanece inalterada (valores atuais do registro)
        const updatedMatriculaTecnico = current.matricula_tecnico;
        const updatedNomeTecnico = current.nome_tecnico;
        const updatedTipoServico = current.tipo_servico;
        const updatedNumeroPgo = current.numero_pgo;
        const updatedGOrigem = current.g_origem;
        const updatedNumeroContrato = current.numero_contrato;
        const updatedNomeCliente = current.nome_cliente;
        const updatedDescricaoServico = current.descricao_servico;

        // Seção 2: Supervisor atualiza Orçamento, Data Liberação e GEOR
        const updatedNumeroOrcamento = numero_orcamento !== undefined ? String(numero_orcamento).trim() : current.numero_orcamento;
        const updatedValorTotal = current.valor_total; // Mantém valor sob gestão exclusiva da Consultora
        const updatedGeorLiberou = geor_liberou !== undefined ? (geor_liberou === 'Sim' ? 'Sim' : 'Não') : current.geor_liberou;
        let updatedDataLiberacao = current.data_liberacao;
        if (updatedGeorLiberou === 'Sim') {
          updatedDataLiberacao = data_liberacao || current.data_liberacao || new Date().toISOString().split('T')[0];
        } else if (data_liberacao !== undefined) {
          updatedDataLiberacao = data_liberacao || null;
        }

        // Seção 3: Status atualizado automaticamente conforme GEOR
        const updatedStatus = updatedGeorLiberou === 'Sim' ? 'Liberado GEOR' : (current.status === 'Aberto' ? 'Aguardando GEOR' : current.status);
        const updatedDataEnvioCliente = current.data_envio_cliente;

        db.prepare(`
          UPDATE chamados_orcamentos SET
            matricula_tecnico = ?,
            nome_tecnico = ?,
            tipo_servico = ?,
            numero_pgo = ?,
            g_origem = ?,
            numero_contrato = ?,
            nome_cliente = ?,
            numero_orcamento = ?,
            descricao_servico = ?,
            valor_total = ?,
            data_liberacao = ?,
            geor_liberou = ?,
            data_envio_cliente = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          updatedMatriculaTecnico,
          updatedNomeTecnico,
          updatedTipoServico,
          updatedNumeroPgo,
          updatedGOrigem,
          updatedNumeroContrato,
          updatedNomeCliente,
          updatedNumeroOrcamento,
          updatedDescricaoServico,
          updatedValorTotal,
          updatedDataLiberacao,
          updatedGeorLiberou,
          updatedDataEnvioCliente,
          updatedStatus,
          id
        );

        const atualizado = db.prepare('SELECT * FROM chamados_orcamentos WHERE id = ?').get(id);
        return res.status(200).json({
          success: true,
          message: 'Liberação da supervisão salva com sucesso.',
          data: atualizado
        });
      }

      // =====================================================================
      // REGRA 3: CONSULTORA (ADMIN) -> CONTROLE IRRESTRITO EM TODAS AS SEÇÕES
      // =====================================================================
      let updatedMatriculaTecnico = current.matricula_tecnico;
      let updatedNomeTecnico = current.nome_tecnico;

      if (matricula_tecnico) {
        updatedMatriculaTecnico = matricula_tecnico;
        if (nome_tecnico) {
          updatedNomeTecnico = nome_tecnico;
        } else {
          const tec = db.prepare('SELECT nome_sobrenome FROM tecnicos WHERE matricula = ?').get(matricula_tecnico);
          if (tec) updatedNomeTecnico = tec.nome_sobrenome;
        }
      }

      const resolvedContrato = String(numero_elevador || numero_contrato || current.numero_contrato).trim();
      let updatedNomeCliente = current.nome_cliente;
      if (resolvedContrato && resolvedContrato !== current.numero_contrato) {
        const cli = db.prepare('SELECT nome_cliente FROM clientes WHERE numero_contrato = ?').get(resolvedContrato);
        if (cli) updatedNomeCliente = cli.nome_cliente;
      } else if (nome_cliente) {
        updatedNomeCliente = nome_cliente;
      }

      const updatedTipoServico = tipo_servico || current.tipo_servico;
      const updatedNumeroPgo = numero_pgo || current.numero_pgo;

      // Validação de G de Origem
      let updatedGOrigem = current.g_origem || 'G11';
      if (g_origem !== undefined && g_origem !== null && g_origem !== '') {
        if (!['G11', 'G06', 'G05'].includes(g_origem)) {
          return res.status(400).json({
            success: false,
            error: 'G de Origem inválido. As opções permitidas são: G11, G06 ou G05.'
          });
        }
        updatedGOrigem = g_origem;
      }

      const updatedNumeroOrcamento = numero_orcamento !== undefined ? String(numero_orcamento).trim() : current.numero_orcamento;
      const updatedDescricaoServico = descricao_servico !== undefined ? descricao_servico : current.descricao_servico;
      const updatedValorTotal = valor_total !== undefined ? (Number(valor_total) || 0.00) : current.valor_total;

      let updatedGeorLiberou = current.geor_liberou;
      let updatedDataLiberacao = current.data_liberacao;
      let updatedDataEnvioCliente = current.data_envio_cliente;
      let updatedStatus = status || current.status;

      if (geor_liberou !== undefined) {
        updatedGeorLiberou = geor_liberou === 'Sim' ? 'Sim' : 'Não';
        if (updatedGeorLiberou === 'Sim' && !data_liberacao && !current.data_liberacao) {
          updatedDataLiberacao = new Date().toISOString().split('T')[0];
        } else if (data_liberacao !== undefined) {
          updatedDataLiberacao = data_liberacao || null;
        }
      }

      if (data_envio_cliente !== undefined) {
        updatedDataEnvioCliente = data_envio_cliente || null;
      }

      db.prepare(`
        UPDATE chamados_orcamentos SET
          matricula_tecnico = ?,
          nome_tecnico = ?,
          tipo_servico = ?,
          numero_pgo = ?,
          g_origem = ?,
          numero_contrato = ?,
          nome_cliente = ?,
          numero_orcamento = ?,
          descricao_servico = ?,
          valor_total = ?,
          data_liberacao = ?,
          geor_liberou = ?,
          data_envio_cliente = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        updatedMatriculaTecnico,
        updatedNomeTecnico,
        updatedTipoServico,
        updatedNumeroPgo,
        updatedGOrigem,
        resolvedContrato,
        updatedNomeCliente,
        updatedNumeroOrcamento,
        updatedDescricaoServico,
        updatedValorTotal,
        updatedDataLiberacao,
        updatedGeorLiberou,
        updatedDataEnvioCliente,
        updatedStatus,
        id
      );

      const atualizado = db.prepare('SELECT * FROM chamados_orcamentos WHERE id = ?').get(id);

      return res.status(200).json({
        success: true,
        message: 'Orçamento atualizado com sucesso pela Consultora.',
        data: atualizado
      });
    } catch (error) {
      console.error('❌ [Orcamento Controller] Erro ao atualizar chamado:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar chamado.'
      });
    }
  },

  // Excluir chamado (Apenas Consultora)
  async delete(req, res) {
    try {
      const { id } = req.params;

      if (!PERMISSIONS.canDeleteRecord(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas usuários com perfil CONSULTORA possuem permissão para excluir registros.'
        });
      }

      const result = db.prepare('DELETE FROM chamados_orcamentos WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Chamado não encontrado para exclusão.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Chamado/Orçamento excluído com sucesso.'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir chamado.'
      });
    }
  }
};
