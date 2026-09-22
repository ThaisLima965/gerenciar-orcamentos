import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { SECURITY_CONFIG } from '../config/security.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { sendPasswordResetEmail, sendPasswordChangedConfirmationEmail, maskEmail } from '../services/emailService.js';

export const authController = {
  // Login corporativo seguro
  async login(req, res) {
    try {
      const { identificador, senha } = req.body;

      if (!identificador || !senha) {
        return res.status(400).json({
          success: false,
          error: 'Identificador (E-mail ou Matrícula) e senha são obrigatórios.'
        });
      }

      const cleanIdentificador = String(identificador).trim().toLowerCase();

      // Busca o usuário por e-mail ou matrícula
      const user = db.prepare(`
        SELECT id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo 
        FROM usuarios 
        WHERE LOWER(email) = ? OR LOWER(matricula) = ?
      `).get(cleanIdentificador, cleanIdentificador);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas. Verifique seu e-mail/matrícula e senha.'
        });
      }

      if (user.ativo !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Usuário desativado pelo administrador. Contate o suporte ou a Consultora.'
        });
      }

      // Validação segura de senha com bcrypt
      const isPasswordValid = bcrypt.compareSync(senha, user.senha_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas. Verifique seu e-mail/matrícula e senha.'
        });
      }

      const isPrimeiroAcesso = Boolean(user.primeiro_acesso);

      // Payload JWT
      const tokenPayload = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        matricula: user.matricula,
        perfil: user.perfil,
        grupo: user.grupo || 'G11',
        primeiro_acesso: isPrimeiroAcesso
      };

      // Gera o token JWT
      const token = jwt.sign(tokenPayload, SECURITY_CONFIG.jwtSecret, {
        expiresIn: SECURITY_CONFIG.jwtExpiresIn
      });

      // Obtém ou gera token CSRF para a sessão
      let csrfToken = req.cookies?.[SECURITY_CONFIG.csrfCookieName];
      if (!csrfToken) {
        csrfToken = generateCsrfToken();
        res.cookie(SECURITY_CONFIG.csrfCookieName, csrfToken, SECURITY_CONFIG.csrfCookieOptions);
      }

      // Define o cookie de autenticação HttpOnly
      res.cookie(SECURITY_CONFIG.authCookieName, token, SECURITY_CONFIG.cookieOptions);

      return res.status(200).json({
        success: true,
        message: 'Autenticação realizada com sucesso.',
        primeiro_acesso: isPrimeiroAcesso,
        csrfToken: csrfToken,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          matricula: user.matricula,
          perfil: user.perfil,
          grupo: user.grupo || 'G11',
          primeiro_acesso: isPrimeiroAcesso
        }
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro no login:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar autenticação.'
      });
    }
  },

  // Redefinição obrigatória de senha no Primeiro Acesso
  async primeiroAcesso(req, res) {
    try {
      const nova_senha = req.body.nova_senha || req.body.novaSenha;
      const confirmar_nova_senha = req.body.confirmar_nova_senha || req.body.confirmarNovaSenha;
      const identificador = req.body.identificador;
      const senha_atual = req.body.senha_atual || req.body.senhaAtual;

      let userId = req.user?.id;
      if (!userId) {
        const token = req.cookies?.[SECURITY_CONFIG.authCookieName];
        if (token) {
          try {
            const decoded = jwt.verify(token, SECURITY_CONFIG.jwtSecret);
            userId = decoded.id;
          } catch (e) {}
        }
      }

      let user = null;

      if (userId) {
        user = db.prepare('SELECT id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo FROM usuarios WHERE id = ?').get(userId);
      } else if (identificador && senha_atual) {
        const cleanIdent = String(identificador).trim().toLowerCase();
        user = db.prepare('SELECT id, nome, email, matricula, senha_hash, perfil, grupo, primeiro_acesso, ativo FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?').get(cleanIdent, cleanIdent);
        if (user && !bcrypt.compareSync(senha_atual, user.senha_hash)) {
          return res.status(401).json({
            success: false,
            error: 'Senha provisória atual inválida.'
          });
        }
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Sessão não identificada. Por favor, faça login para redefinir sua senha.'
        });
      }

      if (!nova_senha || !confirmar_nova_senha) {
        return res.status(400).json({
          success: false,
          error: 'Nova senha e confirmação de senha são obrigatórias.'
        });
      }

      if (nova_senha !== confirmar_nova_senha) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha e a confirmação não coincidem.'
        });
      }

      // Validação de força da senha (Mínimo 6 caracteres, letras e números)
      if (nova_senha.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha deve ter no mínimo 6 caracteres.'
        });
      }

      const hasLetter = /[a-zA-Z]/.test(nova_senha);
      const hasNumber = /[0-9]/.test(nova_senha);
      if (!hasLetter || !hasNumber) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha deve conter pelo menos uma letra e um número.'
        });
      }

      // Verifica se a nova senha é idêntica à senha atual/provisória
      if (bcrypt.compareSync(nova_senha, user.senha_hash)) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha não pode ser idêntica à senha provisória padrão.'
        });
      }

      // Hash da nova senha
      const novoHash = bcrypt.hashSync(nova_senha, 10);

      // Atualiza usuário: define nova senha e remove o flag de primeiro_acesso
      db.prepare(`
        UPDATE usuarios 
        SET senha_hash = ?, primeiro_acesso = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(novoHash, user.id);

      // Gera novo token JWT atualizado
      const tokenPayload = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        matricula: user.matricula,
        perfil: user.perfil,
        grupo: user.grupo || 'G11',
        primeiro_acesso: false
      };

      const token = jwt.sign(tokenPayload, SECURITY_CONFIG.jwtSecret, {
        expiresIn: SECURITY_CONFIG.jwtExpiresIn
      });

      res.cookie(SECURITY_CONFIG.authCookieName, token, SECURITY_CONFIG.cookieOptions);

      return res.status(200).json({
        success: true,
        message: 'Nova senha cadastrada com sucesso! Primeiro acesso concluído.',
        primeiro_acesso: false,
        user: tokenPayload
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao redefinir senha no primeiro acesso:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao redefinir senha.'
      });
    }
  },

  // Obter dados do usuário autenticado atual
  async me(req, res) {
    try {
      return res.status(200).json({
        success: true,
        user: req.user
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao obter dados da sessão.'
      });
    }
  },

  // Obter token CSRF atualizado
  async getCsrf(req, res) {
    let csrfToken = req.cookies?.[SECURITY_CONFIG.csrfCookieName];
    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      res.cookie(SECURITY_CONFIG.csrfCookieName, csrfToken, SECURITY_CONFIG.csrfCookieOptions);
    }
    return res.status(200).json({
      success: true,
      csrfToken
    });
  },

  // Logout seguro com limpeza de cookies
  async logout(req, res) {
    res.clearCookie(SECURITY_CONFIG.authCookieName, { path: '/' });
    res.clearCookie(SECURITY_CONFIG.csrfCookieName, { path: '/' });
    return res.status(200).json({
      success: true,
      message: 'Sessão encerrada com sucesso.'
    });
  },

  // Esqueci minha senha / Disparo seguro para o e-mail cadastrado
  async forgotPassword(req, res) {
    try {
      const { identificador } = req.body;
      if (!identificador) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe seu e-mail corporativo ou matrícula cadastrada.'
        });
      }

      const cleanIdent = String(identificador).trim().toLowerCase();
      const user = db.prepare(`
        SELECT id, nome, email, matricula, ativo 
        FROM usuarios 
        WHERE LOWER(email) = ? OR LOWER(matricula) = ?
      `).get(cleanIdent, cleanIdent);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Nenhum colaborador encontrado com esse e-mail ou matrícula.'
        });
      }

      if (user.ativo !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Usuário desativado. Entre em contato com a Consultora Administradora.'
        });
      }

      // Gera token criptograficamente seguro (expiração em 15 minutos)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresInMinutes = 15;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

      // Invalida tokens anteriores não utilizados do mesmo usuário
      db.prepare(`
        UPDATE password_resets 
        SET used = 1 
        WHERE user_id = ? AND used = 0
      `).run(user.id);

      // Salva novo token no banco de dados
      db.prepare(`
        INSERT INTO password_resets (user_id, token, expires_at, used) 
        VALUES (?, ?, ?, 0)
      `).run(user.id, resetToken, expiresAt);

      // Dispara o e-mail corporativo para o endereço do usuário cadastrado
      const emailResult = await sendPasswordResetEmail({
        nome: user.nome,
        email: user.email,
        resetToken,
        expiresInMinutes
      });

      const maskedEmail = maskEmail(user.email);

      return res.status(200).json({
        success: true,
        message: `As instruções de redefinição de acesso foram enviadas com sucesso para o e-mail corporativo cadastrado (${maskedEmail}).`,
        email: user.email,
        email_mascarado: maskedEmail,
        nome: user.nome,
        is_simulated: emailResult?.mode === 'simulated',
        dev_preview_url: emailResult?.mode === 'simulated' ? emailResult.resetUrl : undefined
      });
    } catch (error) {
      console.error('❌ Erro na recuperação de senha:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar recuperação de senha.'
      });
    }
  },

  // Validação de Token de Redefinição (GET /api/auth/validate-reset-token)
  async validateResetToken(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Token de redefinição não fornecido.'
        });
      }

      const resetRecord = db.prepare(`
        SELECT pr.id, pr.user_id, pr.expires_at, pr.used, u.nome, u.email, u.ativo
        FROM password_resets pr
        JOIN usuarios u ON u.id = pr.user_id
        WHERE pr.token = ?
      `).get(token);

      if (!resetRecord) {
        return res.status(404).json({
          success: false,
          valid: false,
          error: 'Link de redefinição inválido ou não encontrado.'
        });
      }

      if (resetRecord.used === 1) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Este link de redefinição já foi utilizado anteriormente.'
        });
      }

      const now = new Date();
      const expiresAt = new Date(resetRecord.expires_at);
      if (now > expiresAt) {
        return res.status(410).json({
          success: false,
          valid: false,
          error: 'Este link de redefinição expirou. Por favor, solicite um novo link.'
        });
      }

      if (resetRecord.ativo !== 1) {
        return res.status(403).json({
          success: false,
          valid: false,
          error: 'Usuário desativado.'
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        nome: resetRecord.nome,
        email_mascarado: maskEmail(resetRecord.email)
      });
    } catch (error) {
      console.error('❌ Erro ao validar token de redefinição:', error);
      return res.status(500).json({
        success: false,
        valid: false,
        error: 'Erro ao validar token de redefinição.'
      });
    }
  },

  // Execução da Redefinição de Senha via Token (POST /api/auth/reset-password)
  async resetPassword(req, res) {
    try {
      const { token, nova_senha, confirmar_nova_senha } = req.body;

      if (!token || !nova_senha || !confirmar_nova_senha) {
        return res.status(400).json({
          success: false,
          error: 'Token, nova senha e confirmação de senha são obrigatórios.'
        });
      }

      if (nova_senha !== confirmar_nova_senha) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha e a confirmação não coincidem.'
        });
      }

      // Validação de Segurança e Robustez (NIST SP 800-63B)
      if (nova_senha.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'A senha deve conter no mínimo 8 caracteres (recomendado 12+).'
        });
      }

      const hasLetters = /[a-zA-Z]/.test(nova_senha);
      const hasNumbers = /[0-9]/.test(nova_senha);
      if (!hasLetters || !hasNumbers) {
        return res.status(400).json({
          success: false,
          error: 'A senha deve conter uma combinação de letras e números.'
        });
      }

      const resetRecord = db.prepare(`
        SELECT pr.id, pr.user_id, pr.expires_at, pr.used, u.nome, u.email, u.ativo
        FROM password_resets pr
        JOIN usuarios u ON u.id = pr.user_id
        WHERE pr.token = ?
      `).get(token);

      if (!resetRecord) {
        return res.status(404).json({
          success: false,
          error: 'Link de redefinição inválido.'
        });
      }

      if (resetRecord.used === 1) {
        return res.status(400).json({
          success: false,
          error: 'Este link de redefinição já foi utilizado.'
        });
      }

      const now = new Date();
      const expiresAt = new Date(resetRecord.expires_at);
      if (now > expiresAt) {
        return res.status(410).json({
          success: false,
          error: 'Este link de redefinição expirou. Solicite um novo link na tela de login.'
        });
      }

      if (resetRecord.ativo !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Usuário desativado.'
        });
      }

      // Atualiza a senha no banco e zera o flag de primeiro acesso
      const saltRounds = 10;
      const newHash = bcrypt.hashSync(nova_senha, saltRounds);

      db.prepare(`
        UPDATE usuarios 
        SET senha_hash = ?, primeiro_acesso = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newHash, resetRecord.user_id);

      // Marca o token como consumido
      db.prepare(`
        UPDATE password_resets 
        SET used = 1 
        WHERE id = ?
      `).run(resetRecord.id);

      // Envia notificação por e-mail informando a redefinição com sucesso
      await sendPasswordChangedConfirmationEmail({
        nome: resetRecord.nome,
        email: resetRecord.email
      });

      return res.status(200).json({
        success: true,
        message: 'Sua senha foi redefinida com sucesso! Você já pode realizar login.'
      });
    } catch (error) {
      console.error('❌ Erro na redefinição de senha:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao redefinir senha.'
      });
    }
  }
};
