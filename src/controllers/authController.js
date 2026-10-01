import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { SECURITY_CONFIG } from '../config/security.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { neonAuthService } from '../services/neonAuthService.js';

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

  // Esqueci minha senha / Solicitação de Token de Redefinição via Neon
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

      // 1. Gera token seguro e código OTP de 6 dígitos
      const secureToken = crypto.randomBytes(24).toString('hex');
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora de validade

      // 2. Registra o token no banco de dados local
      try {
        db.prepare(`
          INSERT INTO tokens_redefinicao_senha (user_id, email, token, otp_code, expires_at, used)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(user.id, user.email, secureToken, otpCode, expiresAt);
      } catch (dbErr) {
        console.warn('⚠️ [Auth Controller] Aviso ao salvar token na tabela local:', dbErr.message);
      }

      // 3. Sincroniza e aciona envio via Neon Auth
      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const redirectUrl = `${appBaseUrl}/login.html?token=${secureToken}`;
      
      // Sincroniza usuário no Neon Auth (se ainda não cadastrado)
      await neonAuthService.ensureNeonUser(user.nome, user.email, 'TempPassword@12345');
      
      // Dispara envio de link com token e código OTP via serviço de e-mail do Neon
      const neonResetRes = await neonAuthService.requestPasswordReset(user.email, redirectUrl);
      const neonOtpRes = await neonAuthService.requestPasswordResetOTP(user.email);

      const neonEnviado = neonResetRes.success || neonOtpRes.success;

      return res.status(200).json({
        success: true,
        message: 'Token de confirmação e redefinição de senha gerado com sucesso pelo Neon e enviado para o seu e-mail cadastrado.',
        email: user.email,
        nome: user.nome,
        neon_dispatched: neonEnviado,
        // Retorna o token para facilitar homologação/testes em ambiente de desenvolvimento
        dev_token: secureToken,
        dev_otp: otpCode
      });
    } catch (error) {
      console.error('❌ Erro na recuperação de senha via Neon:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar recuperação de senha.'
      });
    }
  },

  // Validação de Token de Redefinição
  async verifyResetToken(req, res) {
    try {
      const { token, otp, email } = req.query;

      if (!token && (!otp || !email)) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Token ou Código OTP de confirmação não informado.'
        });
      }

      let tokenRecord = null;

      if (token) {
        tokenRecord = db.prepare(`
          SELECT t.*, u.nome, u.matricula
          FROM tokens_redefinicao_senha t
          JOIN usuarios u ON u.id = t.user_id
          WHERE t.token = ? AND t.used = 0
        `).get(String(token).trim());
      } else if (otp && email) {
        tokenRecord = db.prepare(`
          SELECT t.*, u.nome, u.matricula
          FROM tokens_redefinicao_senha t
          JOIN usuarios u ON u.id = t.user_id
          WHERE LOWER(t.email) = ? AND t.otp_code = ? AND t.used = 0
        `).get(String(email).trim().toLowerCase(), String(otp).trim());
      }

      if (!tokenRecord) {
        return res.status(404).json({
          success: false,
          valid: false,
          error: 'Token de confirmação inválido ou já utilizado.'
        });
      }

      // Verifica expiração
      if (new Date(tokenRecord.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'O token de confirmação expirou. Solicite um novo token.'
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        email: tokenRecord.email,
        nome: tokenRecord.nome,
        matricula: tokenRecord.matricula
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        valid: false,
        error: 'Erro ao verificar token de redefinição.'
      });
    }
  },

  // Redefinição de Senha com Confirmação de Token / OTP Neon
  async resetPassword(req, res) {
    try {
      const { token, otp, email, identificador, nova_senha, novaSenha, confirmar_nova_senha, confirmarNovaSenha } = req.body;
      const newPass = nova_senha || novaSenha;
      const confirmPass = confirmar_nova_senha || confirmarNovaSenha;

      if (!newPass || !confirmPass) {
        return res.status(400).json({
          success: false,
          error: 'Nova senha e confirmação de senha são obrigatórias.'
        });
      }

      if (newPass !== confirmPass) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha e a confirmação não coincidem.'
        });
      }

      // Validação de força da senha (Mínimo 6 caracteres, letras e números)
      if (newPass.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha deve ter no mínimo 6 caracteres.'
        });
      }

      const hasLetter = /[a-zA-Z]/.test(newPass);
      const hasNumber = /[0-9]/.test(newPass);
      if (!hasLetter || !hasNumber) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha deve conter pelo menos uma letra e um número.'
        });
      }

      // Localiza o token válido no banco de dados local
      let tokenRecord = null;
      const cleanToken = token ? String(token).trim() : null;
      const cleanOtp = otp ? String(otp).trim() : null;
      const searchEmail = email || identificador;
      const cleanEmail = searchEmail ? String(searchEmail).trim().toLowerCase() : null;

      if (cleanToken) {
        tokenRecord = db.prepare(`
          SELECT t.*, u.id as user_id, u.email as user_email, u.nome as user_nome, u.senha_hash
          FROM tokens_redefinicao_senha t
          JOIN usuarios u ON u.id = t.user_id
          WHERE t.token = ? AND t.used = 0
        `).get(cleanToken);
      }

      if (!tokenRecord && cleanOtp && cleanEmail) {
        tokenRecord = db.prepare(`
          SELECT t.*, u.id as user_id, u.email as user_email, u.nome as user_nome, u.senha_hash
          FROM tokens_redefinicao_senha t
          JOIN usuarios u ON u.id = t.user_id
          WHERE (LOWER(t.email) = ? OR LOWER(u.matricula) = ?) AND t.otp_code = ? AND t.used = 0
        `).get(cleanEmail, cleanEmail, cleanOtp);
      }

      // Caso não encontre pelo token local, tenta validar diretamente no Neon Auth
      if (!tokenRecord && cleanToken) {
        const neonRes = await neonAuthService.resetPasswordWithToken(cleanToken, newPass);
        if (neonRes.success) {
          // Se o Neon validou o token, atualiza o usuário no banco local
          if (cleanEmail) {
            const user = db.prepare('SELECT id FROM usuarios WHERE LOWER(email) = ? OR LOWER(matricula) = ?').get(cleanEmail, cleanEmail);
            if (user) {
              const novoHash = bcrypt.hashSync(newPass, 10);
              db.prepare('UPDATE usuarios SET senha_hash = ?, primeiro_acesso = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(novoHash, user.id);
            }
          }
          return res.status(200).json({
            success: true,
            message: 'Senha redefinida com sucesso via confirmação de token Neon! Você já pode fazer login com sua nova senha.'
          });
        }
      }

      if (!tokenRecord) {
        return res.status(400).json({
          success: false,
          error: 'Token ou código de confirmação inválido ou expirado. Solicite uma nova redefinição.'
        });
      }

      // Verifica validade temporal
      if (new Date(tokenRecord.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'O token de confirmação expirou. Por favor, solicite um novo token.'
        });
      }

      // Evita reutilização da mesma senha anterior
      if (bcrypt.compareSync(newPass, tokenRecord.senha_hash)) {
        return res.status(400).json({
          success: false,
          error: 'A nova senha não pode ser idêntica à senha anterior.'
        });
      }

      // 1. Gera novo hash bcrypt
      const novoHash = bcrypt.hashSync(newPass, 10);

      // 2. Atualiza a senha no banco local e desativa primeiro_acesso
      db.prepare(`
        UPDATE usuarios 
        SET senha_hash = ?, primeiro_acesso = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(novoHash, tokenRecord.user_id);

      // 3. Marca token como utilizado
      db.prepare('UPDATE tokens_redefinicao_senha SET used = 1 WHERE id = ?').run(tokenRecord.id);

      // 4. Sincroniza a nova senha com o Neon Auth em background
      neonAuthService.resetPasswordWithToken(tokenRecord.token, newPass).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Senha redefinida com sucesso via token Neon! Você já pode acessar sua conta.'
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao redefinir senha com token:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao redefinir senha.'
      });
    }
  }
};

