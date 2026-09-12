import * as xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import { PERMISSIONS } from '../middleware/rbac.js';

export const usuarioController = {
  // Listar usuários do sistema (Exclusivo Consultora)
  async list(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso restrito à Consultora.'
        });
      }

      const usuarios = db.prepare(`
        SELECT id, nome, email, matricula, perfil, grupo, primeiro_acesso, ativo, created_at, updated_at 
        FROM usuarios 
        ORDER BY nome ASC
      `).all();

      return res.status(200).json({
        success: true,
        data: usuarios
      });
    } catch (error) {
      console.error('❌ Erro ao listar usuários:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar usuários.'
      });
    }
  },

  // Criar novo colaborador / usuário (Exclusivo Consultora)
  async create(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora pode cadastrar novos usuários.'
        });
      }

      const { nome, email, matricula, senha, perfil, grupo } = req.body;

      if (!nome || !email || !perfil) {
        return res.status(400).json({
          success: false,
          error: 'Campos obrigatórios: Nome Completo, E-mail corporativo / Login e Perfil de Acesso.'
        });
      }

      const cleanNome = String(nome).trim();
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanPerfil = String(perfil).trim().toUpperCase();
      const cleanGrupo = String(grupo || 'G11').trim().toUpperCase();
      const rawSenha = String(senha || 'Tke@1234').trim();

      if (!['TECNICO', 'SUPERVISOR', 'CONSULTORA'].includes(cleanPerfil)) {
        return res.status(400).json({
          success: false,
          error: 'Perfil de Acesso inválido. As opções permitidas são: TECNICO, SUPERVISOR ou CONSULTORA.'
        });
      }

      if (!['G11', 'G06', 'G05'].includes(cleanGrupo)) {
        return res.status(400).json({
          success: false,
          error: 'Grupo / Nível inválido. As opções válidas são: G11, G06 ou G05.'
        });
      }

      // Resolução de Matrícula
      let cleanMatricula = matricula ? String(matricula).trim() : '';
      if (!cleanMatricula) {
        // Se não fornecida matrícula, gera uma baseada em número ou no login
        const lastTec = db.prepare('SELECT MAX(CAST(matricula AS INTEGER)) as max_mat FROM usuarios WHERE matricula GLOB "[0-9]*"').get();
        const nextNum = (lastTec?.max_mat && lastTec.max_mat >= 1000) ? lastTec.max_mat + 1 : 1009;
        cleanMatricula = String(nextNum);
      }

      const existing = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = ? OR matricula = ?').get(cleanEmail, cleanMatricula);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Já existe um usuário cadastrado com este e-mail ou matrícula.'
        });
      }

      const senhaHash = bcrypt.hashSync(rawSenha, 10);

      const result = db.prepare(`
        INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1)
      `).run(cleanNome, cleanEmail, cleanMatricula, senhaHash, cleanPerfil, cleanGrupo);

      // Se for perfil Técnico, sincroniza automaticamente na tabela de técnicos de apoio
      if (cleanPerfil === 'TECNICO') {
        db.prepare(`
          INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email)
          VALUES (?, 'Técnico de Manutenção', ?, ?)
          ON CONFLICT(matricula) DO UPDATE SET
            nome_sobrenome = excluded.nome_sobrenome,
            email = excluded.email
        `).run(cleanMatricula, cleanNome, cleanEmail);
      }

      return res.status(201).json({
        success: true,
        message: 'Novo colaborador cadastrado com sucesso com status de Primeiro Acesso pendente.',
        data: {
          id: result.lastInsertRowid,
          nome: cleanNome,
          email: cleanEmail,
          matricula: cleanMatricula,
          perfil: cleanPerfil,
          grupo: cleanGrupo,
          primeiro_acesso: true,
          senha_provisoria: rawSenha
        }
      });
    } catch (error) {
      console.error('❌ Erro ao cadastrar colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao cadastrar colaborador.'
      });
    }
  },

  // Alterar dados de um colaborador (Exclusivo Consultora)
  async update(req, res) {
    try {
      if (req.user?.perfil !== 'CONSULTORA') {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora pode alterar dados de usuários.'
        });
      }

      const { id } = req.params;
      const { nome, email, matricula, perfil, grupo, ativo } = req.body;

      const existing = db.prepare('SELECT id, nome, email, matricula, perfil, grupo, ativo FROM usuarios WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Colaborador não encontrado.'
        });
      }

      const cleanNome = String(nome || existing.nome).trim();
      const cleanEmail = String(email || existing.email).trim().toLowerCase();
      const cleanMatricula = String(matricula || existing.matricula).trim();
      const cleanPerfil = String(perfil || existing.perfil).toUpperCase().trim();
      const cleanGrupo = String(grupo || existing.grupo || 'G11').toUpperCase().trim();
      const cleanAtivo = ativo !== undefined ? (Boolean(ativo) ? 1 : 0) : existing.ativo;

      if (!cleanNome || !cleanEmail || !cleanMatricula) {
        return res.status(400).json({
          success: false,
          error: 'Nome, E-mail e Matrícula são obrigatórios.'
        });
      }

      if (!['TECNICO', 'SUPERVISOR', 'CONSULTORA'].includes(cleanPerfil)) {
        return res.status(400).json({
          success: false,
          error: 'Perfil inválido. As opções permitidas são: TECNICO, SUPERVISOR ou CONSULTORA.'
        });
      }

      if (!['G11', 'G06', 'G05'].includes(cleanGrupo)) {
        return res.status(400).json({
          success: false,
          error: 'Grupo inválido. Opções: G11, G06, G05.'
        });
      }

      // Valida conflito de e-mail ou matrícula com outro usuário
      const colidiu = db.prepare('SELECT id FROM usuarios WHERE (LOWER(email) = ? OR matricula = ?) AND id != ?').get(cleanEmail, cleanMatricula, id);
      if (colidiu) {
        return res.status(400).json({
          success: false,
          error: 'Já existe outro colaborador cadastrado com este e-mail ou matrícula.'
        });
      }

      db.prepare(`
        UPDATE usuarios 
        SET nome = ?, email = ?, matricula = ?, perfil = ?, grupo = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanNome, cleanEmail, cleanMatricula, cleanPerfil, cleanGrupo, cleanAtivo, id);

      // Sincroniza tabela de tecnicos
      const tecExists = db.prepare('SELECT matricula FROM tecnicos WHERE matricula = ? OR LOWER(email) = ?').get(existing.matricula, cleanEmail);
      if (tecExists) {
        db.prepare('UPDATE tecnicos SET matricula = ?, nome_sobrenome = ?, email = ? WHERE matricula = ?').run(cleanMatricula, cleanNome, cleanEmail, tecExists.matricula);
      } else if (cleanPerfil === 'TECNICO' || cleanPerfil === 'SUPERVISOR') {
        db.prepare('INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email) VALUES (?, ?, ?, ?)').run(cleanMatricula, 'Técnico de Manutenção', cleanNome, cleanEmail);
      }

      // Sincroniza histórico de orçamentos e chamados do colaborador
      try {
        db.prepare('UPDATE chamados_orcamentos SET g_origem = ?, nome_tecnico = ? WHERE matricula_tecnico = ? OR matricula_tecnico = ?').run(
          cleanGrupo, 
          cleanNome, 
          cleanMatricula, 
          existing.matricula
        );
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: 'Dados do colaborador alterados com sucesso!',
        data: {
          id: Number(id),
          nome: cleanNome,
          email: cleanEmail,
          matricula: cleanMatricula,
          perfil: cleanPerfil,
          grupo: cleanGrupo,
          ativo: cleanAtivo
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar colaborador.'
      });
    }
  },

  // Atualização rápida de Grupo / Nível (Exclusivo Consultora)
  async updateGrupo(req, res) {
    try {
      if (req.user?.perfil !== 'CONSULTORA') {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora pode alterar o Grupo / Nível dos colaboradores.'
        });
      }

      const { id } = req.params;
      const { grupo } = req.body;

      const user = db.prepare('SELECT id, nome, matricula, grupo FROM usuarios WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Colaborador não encontrado.'
        });
      }

      let cleanGrupo = 'G11';
      const rawStr = String(grupo || '').toUpperCase().trim();
      const digits = rawStr.replace(/\D/g, '');
      if (digits === '11' || rawStr.includes('G11')) cleanGrupo = 'G11';
      else if (digits === '6' || digits === '06' || rawStr.includes('G06') || rawStr.includes('G6')) cleanGrupo = 'G06';
      else if (digits === '5' || digits === '05' || rawStr.includes('G05') || rawStr.includes('G5')) cleanGrupo = 'G05';
      else if (rawStr.startsWith('G')) cleanGrupo = rawStr.substring(0, 10);

      db.prepare('UPDATE usuarios SET grupo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cleanGrupo, id);

      // Sincroniza chamados do técnico com o novo grupo
      if (user.matricula) {
        try {
          db.prepare('UPDATE chamados_orcamentos SET g_origem = ? WHERE matricula_tecnico = ?').run(cleanGrupo, user.matricula);
        } catch (e) {}
      }

      return res.status(200).json({
        success: true,
        message: `Grupo de ${user.nome} alterado para ${cleanGrupo} com sucesso!`,
        data: {
          id: Number(id),
          grupo: cleanGrupo
        }
      });
    } catch (error) {
      console.error('❌ Erro ao atualizar grupo:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao atualizar grupo.'
      });
    }
  },

  // Resetar senha de um colaborador para provisória (Exclusivo Consultora)
  async resetPassword(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora pode resetar senhas de usuários.'
        });
      }

      const { id } = req.params;
      const { nova_senha_provisoria } = req.body;

      const user = db.prepare('SELECT id, nome, email, matricula FROM usuarios WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado.'
        });
      }

      const rawSenha = String(nova_senha_provisoria || 'Tke@1234').trim();
      const senhaHash = bcrypt.hashSync(rawSenha, 10);

      db.prepare(`
        UPDATE usuarios 
        SET senha_hash = ?, primeiro_acesso = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(senhaHash, id);

      return res.status(200).json({
        success: true,
        message: `Senha de ${user.nome} resetada com sucesso para a provisória "${rawSenha}". O usuário deverá trocá-la no próximo acesso.`,
        data: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          senha_provisoria: rawSenha,
          primeiro_acesso: true
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao resetar senha do usuário.'
      });
    }
  },

  // Ativar / Desativar acesso do colaborador (Exclusivo Consultora)
  async toggleStatus(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora pode alterar o status de acesso de usuários.'
        });
      }

      const { id } = req.params;
      const user = db.prepare('SELECT id, nome, email, ativo FROM usuarios WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado.'
        });
      }

      if (user.id === req.user.id) {
        return res.status(400).json({
          success: false,
          error: 'Você não pode desativar o seu próprio perfil de usuário ativo.'
        });
      }

      const novoStatus = user.ativo === 1 ? 0 : 1;
      db.prepare('UPDATE usuarios SET ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(novoStatus, id);

      return res.status(200).json({
        success: true,
        message: `Acesso de ${user.nome} ${novoStatus === 1 ? 'ativado' : 'desativado'} com sucesso.`,
        data: {
          id: user.id,
          ativo: novoStatus
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao alterar status do usuário.'
      });
    }
  },

  // Importar planilha Excel (.xlsx / .xls) ou CSV para Usuários (Exclusivo Consultora)
  async importarPlanilha(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Apenas a Consultora pode importar usuários.'
        });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum arquivo enviado. Selecione uma planilha Excel (.xlsx, .xls) ou arquivo CSV.'
        });
      }

      let workbook;
      try {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      } catch (readErr) {
        return res.status(400).json({
          success: false,
          error: 'Não foi possível ler a planilha enviada. Verifique se é um arquivo Excel (.xlsx, .xls) ou CSV válido.'
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
        const rowNumber = index + 2;

        const nome = findField(row, [
          'Nome_Completo', 'nome_completo', 'NomeCompleto', 'Nome_Sobrenome', 
          'nome_sobrenome', 'NomeSobrenome', 'Nome', 'Colaborador', 'Usuario'
        ]);

        const email = findField(row, [
          'Email', 'email', 'E-mail', 'Login', 'Usuario_Email', 'Correio'
        ]);

        const matricula = findField(row, [
          'Matricula', 'matricula', 'Matrícula', 'ID', 'Codigo', 'Cod'
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

        let perfil = parsedFuncao.perfil || (rawFuncaoOrCargo.toUpperCase().includes('SUPERV') ? 'SUPERVISOR' : (rawFuncaoOrCargo.toUpperCase().includes('CONSULT') ? 'CONSULTORA' : 'TECNICO'));
        let grupo = parsedGrupo.grupo || parsedFuncao.grupo || 'G11';
        let cleanFuncao = parsedFuncao.funcao || (perfil === 'SUPERVISOR' ? 'Supervisor' : (perfil === 'CONSULTORA' ? 'Consultora' : 'Técnico de Manutenção'));

        const rawSenha = findField(row, [
          'Senha_Provisoria', 'senha_provisoria', 'Senha_Padrao', 'Senha', 'Password'
        ]) || 'Tke@1234';

        if (!nome && !email) {
          return; // Linha vazia
        }

        if (!nome) {
          errors.push(`Linha ${rowNumber}: Nome Completo não informado.`);
          return;
        }

        if (!email) {
          errors.push(`Linha ${rowNumber}: E-mail/Login não informado para o colaborador "${nome}".`);
          return;
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanNome = nome.trim();
        const cleanMatricula = matricula ? matricula.trim() : null;

        // Upsert no banco de usuários
        const existingByEmail = db.prepare('SELECT id, nome, email, matricula FROM usuarios WHERE LOWER(email) = ?').get(cleanEmail);
        const existingByMatricula = cleanMatricula ? db.prepare('SELECT id, nome, email, matricula FROM usuarios WHERE matricula = ?').get(cleanMatricula) : null;

        const existing = existingByEmail || existingByMatricula;

        if (existing) {
          db.prepare(`
            UPDATE usuarios 
            SET nome = ?, matricula = COALESCE(?, matricula), perfil = ?, grupo = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(cleanNome, cleanMatricula, perfil, grupo, existing.id);

          updatedCount++;
        } else {
          const finalMatricula = cleanMatricula || `USR-${Math.floor(1000 + Math.random() * 9000)}`;
          const senhaHash = bcrypt.hashSync(rawSenha, 10);

          db.prepare(`
            INSERT INTO usuarios (nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo) 
            VALUES (?, ?, ?, ?, ?, ?, 1, 1)
          `).run(cleanNome, cleanEmail, finalMatricula, senhaHash, perfil, grupo);

          insertedCount++;
        }

        // Sincroniza também na tabela tecnicos
        if (perfil === 'TECNICO' || perfil === 'SUPERVISOR') {
          const tecMatricula = cleanMatricula || `TEC-${cleanEmail.split('@')[0]}`;
          const existingTec = db.prepare('SELECT matricula FROM tecnicos WHERE matricula = ?').get(tecMatricula);
          if (existingTec) {
            db.prepare('UPDATE tecnicos SET nome_sobrenome = ?, email = ?, funcao = ? WHERE matricula = ?').run(
              cleanNome, 
              cleanEmail, 
              cleanFuncao, 
              tecMatricula
            );
          } else {
            db.prepare('INSERT INTO tecnicos (matricula, funcao, nome_sobrenome, email) VALUES (?, ?, ?, ?)').run(
              tecMatricula,
              cleanFuncao,
              cleanNome,
              cleanEmail
            );
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: `Importação de usuários concluída com sucesso! ${insertedCount} inseridos, ${updatedCount} atualizados.`,
        stats: {
          totalRows: rawRows.length,
          inserted: insertedCount,
          updated: updatedCount,
          errorsCount: errors.length
        },
        errors
      });
    } catch (error) {
      console.error('❌ Erro na importação de usuários:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar a importação de colaboradores.'
      });
    }
  },

  // Gerar e baixar modelo de planilha de usuários (.xlsx ou .csv)
  async downloadTemplate(req, res) {
    try {
      const format = (req.query.format || 'xlsx').toLowerCase();

      const sampleData = [
        {
          'Nome_Completo': 'Mariana Souza Dias',
          'Email': 'mariana.dias@empresa.com',
          'Matricula': '1009',
          'Perfil': 'TECNICO',
          'Grupo': 'G11',
          'Senha_Provisoria': 'Tke@1234'
        },
        {
          'Nome_Completo': 'Carlos Roberto Lima',
          'Email': 'carlos.lima@empresa.com',
          'Matricula': '2005',
          'Perfil': 'SUPERVISOR',
          'Grupo': 'G06',
          'Senha_Provisoria': 'Tke@1234'
        },
        {
          'Nome_Completo': 'Patrícia Albuquerque',
          'Email': 'patricia.albuquerque@empresa.com',
          'Matricula': '3005',
          'Perfil': 'CONSULTORA',
          'Grupo': 'G05',
          'Senha_Provisoria': 'Tke@1234'
        }
      ];

      const ws = xlsx.utils.json_to_sheet(sampleData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Usuarios');

      if (format === 'csv') {
        const csvContent = xlsx.utils.sheet_to_csv(ws);
        const bomCsvBuffer = Buffer.concat([Buffer.from('\uFEFF', 'utf8'), Buffer.from(csvContent, 'utf8')]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="modelo_colaboradores.csv"');
        return res.send(bomCsvBuffer);
      } else {
        const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="modelo_colaboradores.xlsx"');
        return res.send(xlsxBuffer);
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Erro ao gerar modelo de colaboradores.' });
    }
  },

  // Excluir colaborador do sistema (Exclusivo Consultora)
  async delete(req, res) {
    try {
      if (!PERMISSIONS.canManageCadastros(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Apenas a Consultora pode excluir colaboradores.'
        });
      }

      const { id } = req.params;
      const user = db.prepare('SELECT id, nome, email, matricula, perfil FROM usuarios WHERE id = ?').get(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Colaborador não encontrado.'
        });
      }

      if (user.id === req.user.id) {
        return res.status(400).json({
          success: false,
          error: 'Você não pode excluir o seu próprio perfil de usuário ativo.'
        });
      }

      // Se for técnico, desassocia de chamados vinculados
      try {
        db.prepare('UPDATE chamados_orcamentos SET created_by_id = NULL WHERE created_by_id = ?').run(id);
      } catch (e) {}

      db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);

      return res.status(200).json({
        success: true,
        message: `Colaborador ${user.nome} excluído com sucesso.`
      });
    } catch (error) {
      console.error('❌ Erro ao excluir colaborador:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao excluir colaborador.'
      });
    }
  }
};
