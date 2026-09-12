import * as xlsx from 'xlsx';
import { db } from '../config/database.js';
import { PERMISSIONS } from '../middleware/rbac.js';

export const tecnicoController = {
  // Listar todos os técnicos
  async list(req, res) {
    try {
      const tecnicos = db.prepare(`
        SELECT matricula, COALESCE(funcao, 'Técnico de Manutenção') AS funcao, nome_sobrenome, email, telefone, created_at 
        FROM tecnicos 
        ORDER BY CAST(matricula AS INTEGER) ASC, nome_sobrenome ASC
      `).all();
      return res.status(200).json({
        success: true,
        data: tecnicos
      });
    } catch (error) {
      console.error('❌ Erro ao listar técnicos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar técnicos.'
      });
    }
  },

  // Cadastrar novo técnico manualmente (Consultora e Supervisor)
  async create(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora ou Supervisor podem cadastrar novos técnicos.'
        });
      }
      const { matricula, funcao, nome_sobrenome, nome_completo, email, telefone } = req.body;
      const finalNome = String(nome_completo || nome_sobrenome || '').trim();
      const cleanMatricula = String(matricula || '').trim();
      const cleanFuncao = String(funcao || 'Técnico de Manutenção').trim();

      if (!cleanMatricula || !finalNome) {
        return res.status(400).json({
          success: false,
          error: 'Matrícula e Nome Completo são obrigatórios.'
        });
      }

      const existing = db.prepare('SELECT matricula FROM tecnicos WHERE matricula = ?').get(cleanMatricula);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Já existe um técnico cadastrado com esta matrícula.'
        });
      }

      db.prepare('INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone) VALUES (?, ?, ?, ?, ?)').run(
        cleanMatricula,
        cleanFuncao,
        finalNome,
        email ? String(email).trim() : null,
        telefone ? String(telefone).trim() : null
      );

      return res.status(201).json({
        success: true,
        message: 'Técnico cadastrado com sucesso.',
        data: { matricula: cleanMatricula, funcao: cleanFuncao, nome_sobrenome: finalNome, email, telefone }
      });
    } catch (error) {
      console.error('❌ Erro ao cadastrar técnico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao cadastrar técnico.'
      });
    }
  },

  // Alterar cadastro de técnico (Exclusivo Consultora)
  async update(req, res) {
    try {
      if (req.user?.perfil !== 'CONSULTORA') {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora possui permissão para alterar cadastros de técnicos.'
        });
      }

      const { matricula } = req.params;
      const { funcao, nome_sobrenome, nome_completo, email, telefone, nova_matricula } = req.body;

      const cleanMatricula = String(matricula || '').trim();
      const finalNome = String(nome_completo || nome_sobrenome || '').trim();
      const cleanFuncao = String(funcao || 'Técnico de Manutenção').trim();
      const targetMatricula = String(nova_matricula || cleanMatricula).trim();

      const existing = db.prepare('SELECT matricula, nome_sobrenome, funcao, email, telefone FROM tecnicos WHERE matricula = ?').get(cleanMatricula);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Técnico com matrícula '${cleanMatricula}' não encontrado.`
        });
      }

      if (!finalNome) {
        return res.status(400).json({
          success: false,
          error: 'O Nome Completo do técnico é obrigatório.'
        });
      }

      // Se a matrícula estiver sendo alterada, verifica colisão
      if (targetMatricula !== cleanMatricula) {
        const colidiu = db.prepare('SELECT matricula FROM tecnicos WHERE matricula = ?').get(targetMatricula);
        if (colidiu) {
          return res.status(400).json({
            success: false,
            error: `Já existe outro técnico cadastrado com a matrícula '${targetMatricula}'.`
          });
        }
      }

      // Atualiza registro do técnico
      db.prepare(`
        UPDATE tecnicos 
        SET matricula = ?, funcao = ?, nome_sobrenome = ?, email = ?, telefone = ?
        WHERE matricula = ?
      `).run(
        targetMatricula,
        cleanFuncao,
        finalNome,
        email ? String(email).trim() : null,
        telefone ? String(telefone).trim() : null,
        cleanMatricula
      );

      // Sincroniza chamados_orcamentos associados
      db.prepare(`
        UPDATE chamados_orcamentos 
        SET matricula_tecnico = ?, nome_tecnico = ?
        WHERE matricula_tecnico = ?
      `).run(targetMatricula, finalNome, cleanMatricula);

      // Sincroniza tabela usuarios se existir usuario vinculado a essa matricula
      db.prepare(`
        UPDATE usuarios 
        SET matricula = ?, nome = ?
        WHERE matricula = ?
      `).run(targetMatricula, finalNome, cleanMatricula);

      return res.status(200).json({
        success: true,
        message: 'Cadastro de técnico alterado com sucesso!',
        data: {
          matricula: targetMatricula,
          funcao: cleanFuncao,
          nome_sobrenome: finalNome,
          email,
          telefone
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar técnico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar cadastro do técnico.'
      });
    }
  },

  // Excluir técnico (Exclusivo Consultora)
  async delete(req, res) {
    try {
      if (req.user?.perfil !== 'CONSULTORA') {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora possui permissão para excluir técnicos.'
        });
      }

      const { matricula } = req.params;
      const cleanMatricula = String(matricula || '').trim();

      const existing = db.prepare('SELECT matricula, nome_sobrenome FROM tecnicos WHERE matricula = ?').get(cleanMatricula);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `Técnico com matrícula '${cleanMatricula}' não encontrado.`
        });
      }

      // Verifica se existem orçamentos vinculados
      const chamadosCount = db.prepare('SELECT COUNT(*) as count FROM chamados_orcamentos WHERE matricula_tecnico = ?').get(cleanMatricula)?.count || 0;
      if (chamadosCount > 0) {
        return res.status(400).json({
          success: false,
          error: `Não é possível excluir o técnico ${existing.nome_sobrenome} pois existem ${chamadosCount} chamado(s)/orçamento(s) vinculados a ele.`
        });
      }

      db.prepare('DELETE FROM tecnicos WHERE matricula = ?').run(cleanMatricula);

      return res.status(200).json({
        success: true,
        message: `Técnico ${existing.nome_sobrenome} (Matrícula ${cleanMatricula}) excluído com sucesso.`
      });
    } catch (error) {
      console.error('❌ Erro ao excluir técnico:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao excluir técnico.'
      });
    }
  },

  // Importar planilha Excel (.xlsx) ou CSV para Técnicos (Consultora e Supervisor)
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

      const parseGrupoEFuncao = (rawVal) => {
        if (!rawVal) return { grupo: null, perfil: null, funcao: null };
        const str = String(rawVal).trim();
        if (!str) return { grupo: null, perfil: null, funcao: null };

        let grupo = null;
        let funcaoClean = str;
        let perfil = null;

        // Extrai o número do grupo da frente (ex: "11 - SUPERVISOR", "06 - PREVENTIVO", "6 - PREVENTIVO", "05 - CORRETIVO")
        const prefixMatch = str.match(/^(?:G\s*[-_]?)?(\d{1,2})\s*[-–—/:]?\s*(.*)$/i);
        if (prefixMatch) {
          const num = parseInt(prefixMatch[1], 10);
          if (num === 11) grupo = 'G11';
          else if (num === 6) grupo = 'G06';
          else if (num === 5) grupo = 'G05';
          else if (num < 10) grupo = `G0${num}`;
          else grupo = `G${num}`;

          if (prefixMatch[2] && prefixMatch[2].trim()) {
            funcaoClean = prefixMatch[2].trim();
          }
        } else if (/^G\d+/i.test(str)) {
          const gMatch = str.match(/^(G\d+)\s*[-–—/:]?\s*(.*)$/i);
          if (gMatch) {
            const gPart = gMatch[1].toUpperCase();
            if (gPart === 'G6') grupo = 'G06';
            else if (gPart === 'G5') grupo = 'G05';
            else grupo = gPart;

            if (gMatch[2] && gMatch[2].trim()) {
              funcaoClean = gMatch[2].trim();
            }
          }
        }

        const upper = funcaoClean.toUpperCase();
        if (upper.includes('CONSULT')) {
          perfil = 'CONSULTORA';
          funcaoClean = 'Consultora';
        } else if (upper.includes('SUPERV')) {
          perfil = 'SUPERVISOR';
          funcaoClean = 'Supervisor';
        } else if (upper.includes('PREVENTIV')) {
          perfil = 'TECNICO';
          funcaoClean = 'Preventivo';
        } else if (upper.includes('CORRETIV')) {
          perfil = 'TECNICO';
          funcaoClean = 'Corretivo';
        } else if (upper.includes('RESIDENT')) {
          perfil = 'TECNICO';
          funcaoClean = 'Residente';
        } else if (upper.includes('TECN')) {
          perfil = 'TECNICO';
          funcaoClean = 'Técnico de Manutenção';
        }

        return { grupo, perfil, funcao: funcaoClean };
      };

      rawRows.forEach((row, index) => {
        const rowNumber = index + 2; // Cabeçalho é linha 1

        const matricula = findField(row, [
          'Matricula', 'matricula', 'Matrícula', 'ID', 'Codigo', 'Cod', 'ID_Tecnico'
        ]);

        const rawFuncaoOrCargo = findField(row, [
          'G_Funcao', 'GFuncao', 'G - Funcao', 'G - Função', 'G-Função', 'G-Funcao', 'G_Função', 'G / Funcao', 'G / Função',
          'Funcao', 'funcao', 'Função', 'função', 'Cargo', 'cargo', 'Perfil', 'perfil', 'Perfil_Acesso', 'Tipo', 'Especialidade', 'Posicao'
        ]);

        const rawGrupoField = findField(row, [
          'G_NIVEL', 'GNIVEL', 'G_Nivel', 'G/NIVEL', 'G/Nivel', 'G / NIVEL', 'G / Nivel', 'G / NÍVEL', 'G/NÍVEL',
          'Grupo', 'grupo', 'Grupo_Nivel', 'Nivel', 'Nível', 'G_Origem', 'GOrigem', 'G', 'Filial', 'Posto', 'Regional'
        ]);

        const parsedFuncao = parseGrupoEFuncao(rawFuncaoOrCargo);
        const parsedGrupo = parseGrupoEFuncao(rawGrupoField);

        const finalFuncao = parsedFuncao.funcao || (rawFuncaoOrCargo ? rawFuncaoOrCargo : 'Técnico de Manutenção');
        const finalGrupo = parsedGrupo.grupo || parsedFuncao.grupo || 'G11';
        const finalPerfil = parsedFuncao.perfil || (finalFuncao.toUpperCase().includes('SUPERV') ? 'SUPERVISOR' : 'TECNICO');

        const nomeSobrenome = findField(row, [
          'Nome_Completo', 'nome_completo', 'NomeCompleto', 'Nome_Sobrenome', 
          'nome_sobrenome', 'NomeSobrenome', 'Nome', 'Tecnico', 'Nome_Tecnico'
        ]);

        const email = findField(row, ['Email', 'email', 'E-mail', 'Correio']);
        const telefone = findField(row, ['Telefone', 'telefone', 'Celular', 'Fone', 'Contato']);

        // Linha completamente em branco é ignorada
        if (!matricula && !nomeSobrenome) {
          return;
        }

        // Validação de campos obrigatórios
        if (!matricula) {
          errors.push(`Linha ${rowNumber}: Coluna 'Matricula' não informada.`);
          return;
        }

        if (!nomeSobrenome) {
          errors.push(`Linha ${rowNumber}: Coluna 'Nome_Completo' (ou Nome/Sobrenome) não informada para a matrícula '${matricula}'.`);
          return;
        }

        const cleanMatricula = matricula.trim();
        const cleanNome = nomeSobrenome.trim();
        const cleanEmail = email ? email.toLowerCase().trim() : null;
        const cleanTelefone = telefone ? telefone.trim() : null;

        // Tratamento de duplicados (Upsert / Atualização sem quebrar integridade)
        const existing = db.prepare('SELECT matricula, funcao, email, telefone FROM tecnicos WHERE matricula = ?').get(cleanMatricula);
        if (existing) {
          const tecFuncao = finalFuncao || existing.funcao || 'Técnico de Manutenção';
          const tecEmail = cleanEmail || existing.email;
          const tecTelefone = cleanTelefone || existing.telefone;
          db.prepare('UPDATE tecnicos SET funcao = ?, nome_sobrenome = ?, email = ?, telefone = ? WHERE matricula = ?').run(
            tecFuncao,
            cleanNome, 
            tecEmail, 
            tecTelefone, 
            cleanMatricula
          );
          updatedCount++;
        } else {
          db.prepare('INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email, telefone) VALUES (?, ?, ?, ?, ?)').run(
            cleanMatricula, 
            finalFuncao,
            cleanNome, 
            cleanEmail || null, 
            cleanTelefone || null
          );
          insertedCount++;
        }

        // Sincroniza grupo e perfil na tabela usuarios
        if (cleanEmail || cleanMatricula) {
          const userExisting = cleanEmail ? db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = ?').get(cleanEmail)
            : db.prepare('SELECT id FROM usuarios WHERE matricula = ?').get(cleanMatricula);
          
          if (userExisting) {
            db.prepare('UPDATE usuarios SET grupo = ?, perfil = ?, nome = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
              finalGrupo,
              finalPerfil,
              cleanNome,
              userExisting.id
            );
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: `Importação de técnicos concluída com sucesso! ${insertedCount} inseridos, ${updatedCount} atualizados.`,
        stats: {
          totalRows: rawRows.length,
          inserted: insertedCount,
          updated: updatedCount,
          errorsCount: errors.length
        },
        errors
      });
    } catch (error) {
      console.error('❌ Erro na importação de técnicos:', error);
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
        { 'Matricula': '1001', 'Funcao': 'Técnico de Manutenção', 'Nome_Completo': 'Thiago Silva Santos' },
        { 'Matricula': '1002', 'Funcao': 'Técnico Residente', 'Nome_Completo': 'Marcos Vinicius Costa' },
        { 'Matricula': '1003', 'Funcao': 'Técnico Especialista', 'Nome_Completo': 'Rafael Fernandes Oliveira' }
      ];

      const ws = xlsx.utils.json_to_sheet(sampleData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Tecnicos');

      if (format === 'csv') {
        const csvContent = xlsx.utils.sheet_to_csv(ws);
        const bomCsvBuffer = Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(csvContent, 'utf8')]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="modelo_tecnicos.csv"');
        return res.send(bomCsvBuffer);
      } else {
        const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="modelo_tecnicos.xlsx"');
        return res.send(xlsxBuffer);
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Erro ao gerar modelo de técnicos.' });
    }
  }
};
