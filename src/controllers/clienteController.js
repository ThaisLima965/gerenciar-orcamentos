import * as xlsx from 'xlsx';
import { db } from '../config/database.js';
import { PERMISSIONS } from '../middleware/rbac.js';

export const clienteController = {
  // Listar todos os clientes
  async list(req, res) {
    try {
      const clientes = db.prepare('SELECT numero_contrato, nome_cliente, created_at FROM clientes ORDER BY nome_cliente ASC').all();
      return res.status(200).json({
        success: true,
        data: clientes
      });
    } catch (error) {
      console.error('❌ Erro ao listar clientes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar clientes.'
      });
    }
  },

  // Cadastrar novo cliente manualmente (Consultora e Supervisor)
  async create(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora ou Supervisor podem cadastrar novos clientes.'
        });
      }

      const { numero_contrato, nome_cliente } = req.body;

      if (!numero_contrato || !nome_cliente) {
        return res.status(400).json({
          success: false,
          error: 'Número de contrato e Nome do cliente são obrigatórios.'
        });
      }

      const cleanContrato = String(numero_contrato).trim();
      const cleanNome = String(nome_cliente).trim();

      const existing = db.prepare('SELECT numero_contrato FROM clientes WHERE numero_contrato = ?').get(cleanContrato);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Já existe um cliente cadastrado com este número de contrato.'
        });
      }

      db.prepare('INSERT INTO clientes (numero_contrato, nome_cliente) VALUES (?, ?)').run(cleanContrato, cleanNome);

      return res.status(201).json({
        success: true,
        message: 'Cliente cadastrado com sucesso.',
        data: { numero_contrato: cleanContrato, nome_cliente: cleanNome }
      });
    } catch (error) {
      console.error('❌ Erro ao cadastrar cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao cadastrar cliente.'
      });
    }
  },

  // Alterar cadastro de cliente (Exclusivo Consultora)
  async update(req, res) {
    try {
      if (req.user?.perfil !== 'CONSULTORA') {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora possui permissão para alterar cadastros de clientes.'
        });
      }

      const { numero_contrato } = req.params;
      const { nome_cliente, novo_contrato } = req.body;

      const cleanContrato = String(numero_contrato || '').trim();
      const finalNome = String(nome_cliente || '').trim();
      const targetContrato = String(novo_contrato || cleanContrato).trim();

      const existing = db.prepare('SELECT numero_contrato, nome_cliente FROM clientes WHERE numero_contrato = ?').get(cleanContrato);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Cliente com contrato '${cleanContrato}' não encontrado.`
        });
      }

      if (!finalNome) {
        return res.status(400).json({
          success: false,
          error: 'O Nome do Cliente / Razão Social é obrigatório.'
        });
      }

      // Se o número de contrato estiver sendo alterado, verifica se já existe
      if (targetContrato !== cleanContrato) {
        const colidiu = db.prepare('SELECT numero_contrato FROM clientes WHERE numero_contrato = ?').get(targetContrato);
        if (colidiu) {
          return res.status(400).json({
            success: false,
            error: `Já existe outro cliente cadastrado com o contrato '${targetContrato}'.`
          });
        }
      }

      // Atualiza cliente
      db.prepare('UPDATE clientes SET numero_contrato = ?, nome_cliente = ? WHERE numero_contrato = ?').run(
        targetContrato,
        finalNome,
        cleanContrato
      );

      // Sincroniza chamados_orcamentos associados
      db.prepare('UPDATE chamados_orcamentos SET numero_contrato = ?, nome_cliente = ? WHERE numero_contrato = ?').run(
        targetContrato,
        finalNome,
        cleanContrato
      );

      return res.status(200).json({
        success: true,
        message: 'Cadastro de cliente alterado com sucesso!',
        data: {
          numero_contrato: targetContrato,
          nome_cliente: finalNome
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar cadastro de cliente.'
      });
    }
  },

  // Excluir cliente (Exclusivo Consultora)
  async delete(req, res) {
    try {
      if (req.user?.perfil !== 'CONSULTORA') {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora possui permissão para excluir clientes.'
        });
      }

      const { numero_contrato } = req.params;
      const cleanContrato = String(numero_contrato || '').trim();

      const existing = db.prepare('SELECT numero_contrato, nome_cliente FROM clientes WHERE numero_contrato = ?').get(cleanContrato);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Cliente com contrato '${cleanContrato}' não encontrado.`
        });
      }

      // Verifica se existem orçamentos vinculados
      const chamadosCount = db.prepare('SELECT COUNT(*) as count FROM chamados_orcamentos WHERE numero_contrato = ?').get(cleanContrato)?.count || 0;
      if (chamadosCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Não é possível excluir o cliente ${existing.nome_cliente} pois existem ${chamadosCount} chamado(s)/orçamento(s) vinculados a ele.`
        });
      }

      db.prepare('DELETE FROM clientes WHERE numero_contrato = ?').run(cleanContrato);

      return res.status(200).json({
        success: true,
        message: `Cliente ${existing.nome_cliente} (${cleanContrato}) excluído com sucesso.`
      });
    } catch (error) {
      console.error('❌ Erro ao excluir cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir cliente.'
      });
    }
  },

  // Importar planilha Excel (.xlsx) ou CSV para Clientes (Consultora e Supervisor)
  async importarPlanilha(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Apenas a Consultora ou Supervisor podem importar planilhas.'
        });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado. Selecione uma planilha Excel (.xlsx) ou arquivo CSV.'
        });
      }

      // Leitura da planilha em memória
      let workbook;
      try {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      } catch (readErr) {
        return res.status(400).json({
          success: false,
          error: 'Não foi possível ler o arquivo enviado. Verifique se é um arquivo Excel (.xlsx, .xls) ou CSV válido.'
        });
      }

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          error: 'A planilha enviada está vazia ou não possui abas legíveis.'
        });
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });

      if (!rawRows || rawRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'A planilha enviada não contém linhas de dados.'
        });
      }

      let insertedCount = 0;
      let updatedCount = 0;
      const errors = [];

      // Helper para normalizar e buscar chaves independentemente de maiúsculas/minúsculas ou acentos
      const findField = (row, candidates) => {
        const keys = Object.keys(row);
        for (const candidate of candidates) {
          const normCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const key of keys) {
            const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normKey === normCandidate && String(row[key]).trim() !== '') {
              return String(row[key]).trim();
            }
          }
        }
        return '';
      };

      rawRows.forEach((row, index) => {
        const rowNumber = index + 2; // Cabeçalho é linha 1

        const contrato = findField(row, [
          'Elevador', 'Numero_Elevador', 'NumeroElevador', 'NumElevador', 'Num_Elevador',
          'NElevador', 'N_Elevador', 'Codigo_Elevador', 'CodigoElevador', 'CodElevador', 'Elev',
          'Equipamento', 'Numero_Equipamento', 'Numero_Contrato', 'numero_contrato', 
          'NumeroContrato', 'Contrato', 'Numero_de_Contrato', 'NContrato', 'N_Contrato', 'Id_Elevador'
        ]);

        const cliente = findField(row, [
          'Nome_Cliente', 'nome_cliente', 'NomeCliente', 'Cliente', 
          'Condominio', 'Nome_Condominio', 'Edificio', 'Nome_Edificio', 'Predio',
          'Razao_Social', 'RazaoSocial', 'Empresa', 'Nome'
        ]);

        // Linha completamente em branco é ignorada
        if (!contrato && !cliente) {
          return;
        }

        // Validação de campos obrigatórios
        if (!contrato) {
          errors.push(`Linha ${rowNumber}: Coluna de identificação do Elevador ou Contrato ('Elevador' / 'Numero_Contrato') não informada.`);
          return;
        }

        if (!cliente) {
          errors.push(`Linha ${rowNumber}: Coluna 'Nome_Cliente' não informada para o elevador/contrato '${contrato}'.`);
          return;
        }

        // Tratamento de duplicados (Upsert / Atualização sem quebrar integridade)
        const existing = db.prepare('SELECT numero_contrato FROM clientes WHERE numero_contrato = ?').get(contrato);
        if (existing) {
          db.prepare('UPDATE clientes SET nome_cliente = ? WHERE numero_contrato = ?').run(cliente, contrato);
          updatedCount++;
        } else {
          db.prepare('INSERT INTO clientes (numero_contrato, nome_cliente) VALUES (?, ?)').run(contrato, cliente);
          insertedCount++;
        }
      });

      return res.status(200).json({
        success: true,
        message: `Importação de clientes concluída com sucesso! ${insertedCount} inseridos, ${updatedCount} atualizados.`,
        stats: {
          totalRows: rawRows.length,
          inserted: insertedCount,
          updated: updatedCount,
          errorsCount: errors.length
        },
        errors
      });
    } catch (error) {
      console.error('❌ Erro na importação de clientes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar a importação da planilha.'
      });
    }
  },

  // Gerar e baixar modelo (.xlsx ou .csv) para facilitar o preenchimento pelo usuário
  async downloadTemplate(req, res) {
    try {
      const format = (req.query.format || 'xlsx').toLowerCase();
      
      const sampleData = [
        { 'Elevador': 'ELEV-01', 'Nome_Cliente': 'Condomínio Edifício Paulista' },
        { 'Elevador': 'ELEV-02', 'Nome_Cliente': 'Hospital Central Santa Clara' },
        { 'Elevador': 'CT-2024-003', 'Nome_Cliente': 'Shopping Plaza Norte' }
      ];

      const ws = xlsx.utils.json_to_sheet(sampleData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Clientes');

      if (format === 'csv') {
        const csvContent = xlsx.utils.sheet_to_csv(ws);
        const bomCsvBuffer = Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(csvContent, 'utf8')]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="modelo_clientes.csv"');
        return res.send(bomCsvBuffer);
      } else {
        const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="modelo_clientes.xlsx"');
        return res.send(xlsxBuffer);
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Erro ao gerar modelo de clientes.' });
    }
  }
};
