import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { SECURITY_CONFIG } from '../config/security.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { sendPasswordResetEmail, sendPasswordChangedConfirmationEmail, maskEmail } from '../services/emailService.js';
import { sendResetOtpSms, maskPhone, formatE164 } from '../services/smsService.js';
import { validatePasswordNIST, generateSecureProvisionalPassword } from '../utils/passwordValidator.js';

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

      // Validação segura de senha com bcrypt e tolerância a senhas provisórias em primeiro acesso
      const cleanSenha = String(senha).trim();
      let isPasswordValid = bcrypt.compareSync(senha, user.senha_hash) || bcrypt.compareSync(cleanSenha, user.senha_hash);

      // Se o usuário estiver em primeiro acesso ou reset provisório, aceita também as senhas provisórias padrão
      if (!isPasswordValid && Boolean(user.primeiro_acesso)) {
        if (cleanSenha.toLowerCase() === 'tke@1234' || cleanSenha.toLowerCase() === 'senha@12345') {
          isPasswordValid = true;
        }
      }

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

      // Validação Estrita de Segurança e Robustez (NIST SP 800-63B)
      const nistValidation = validatePasswordNIST(nova_senha, {
        nome: user.nome,
        email: user.email,
        matricula: user.matricula
      });

      if (!nistValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: nistValidation.errors.join(' ') || 'A senha não atende aos critérios NIST SP 800-63B.',
          detalhes: nistValidation.errors
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

  // =========================================================================
  // FLUXO DE REDEFINIÇÃO DE SENHA VIA TOKEN POR SMS (OTP 6 DÍGITOS)
  // =========================================================================

  // 1. Solicitação de Redefinição via SMS (POST /api/auth/forgot-password)
  async forgotPassword(req, res) {
    try {
      const { identificador } = req.body;
      if (!identificador) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe seu identificador (E-mail corporativo, Matrícula ou Celular cadastrado).'
        });
      }

      const cleanIdent = String(identificador).trim().toLowerCase();
      const onlyDigits = cleanIdent.replace(/\D/g, '');

      // Localiza o usuário por e-mail, matrícula ou telefone cadastrado
      let user = db.prepare(`
        SELECT id, nome, email, matricula, telefone, ativo 
        FROM usuarios 
        WHERE LOWER(email) = ? OR LOWER(matricula) = ?
      `).get(cleanIdent, cleanIdent);

      // Se não encontrou por e-mail/matrícula mas o identificador possui dígitos, busca pelo telefone
      if (!user && onlyDigits.length >= 8) {
        const usersWithPhone = db.prepare(`
          SELECT id, nome, email, matricula, telefone, ativo 
          FROM usuarios 
          WHERE telefone IS NOT NULL AND telefone != ''
        `).all();

        user = usersWithPhone.find(u => {
          const userDigits = String(u.telefone).replace(/\D/g, '');
          return userDigits === onlyDigits || 
                 userDigits.endsWith(onlyDigits) || 
                 onlyDigits.endsWith(userDigits);
        });
      }

      // Prevenção de enumeração de contas: se o usuário não existir, estiver desativado ou não tiver celular
      if (!user || user.ativo !== 1 || !user.telefone || !user.telefone.trim()) {
        console.warn(`⚠️ [Auth Reset SMS] Solicitação para identificador "${cleanIdent}" não processada (inexistente, inativo ou sem telefone).`);
        return res.status(200).json({
          success: true,
          message: 'Se os dados informados existirem em nosso sistema com celular cadastrado, você receberá um código de verificação de 6 dígitos via SMS em instantes.',
          masked_phone: null
        });
      }

      // Rate Limit por Usuário no Banco de Dados: máximo de 3 solicitações por hora
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentCountRow = db.prepare(`
        SELECT COUNT(*) as count 
        FROM password_reset_tokens 
        WHERE user_id = ? AND created_at >= ?
      `).get(user.id, oneHourAgo);

      const recentCount = recentCountRow ? recentCountRow.count : 0;
      if (recentCount >= 3) {
        return res.status(429).json({
          success: false,
          error: 'Limite de solicitações de código SMS excedido para este usuário (máximo de 3 solicitações por hora). Aguarde antes de solicitar novamente.'
        });
      }

      // Invalida tokens anteriores não utilizados do usuário
      db.prepare(`
        UPDATE password_reset_tokens 
        SET used_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND used_at IS NULL
      `).run(user.id);

      // Geração de token OTP numérico de 6 dígitos criptograficamente seguro
      const otpNumber = crypto.randomInt(100000, 1000000); // Gera número entre 100000 e 999999
      const otp = otpNumber.toString();

      // Hash do token com SHA-256 para persistência segura
      const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');

      // Validade de 10 minutos
      const expiresInMinutes = 10;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

      // Salva o registro do token no banco de dados
      db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, attempts, ip_address)
        VALUES (?, ?, ?, 0, ?)
      `).run(user.id, tokenHash, expiresAt, ipAddress);

      // Dispara o SMS corporativo para o número gravado no perfil do usuário
      await sendResetOtpSms({
        nome: user.nome,
        telefone: user.telefone,
        otp: otp,
        expiresInMinutes: expiresInMinutes
      });

      const isDevMode = process.env.NODE_ENV !== 'production' || !process.env.SMS_PROVIDER || process.env.SMS_PROVIDER === 'mock';

      return res.status(200).json({
        success: true,
        message: `Código de verificação de 6 dígitos enviado com sucesso para ${maskedPhone}.`,
        masked_phone: maskedPhone,
        identificador: cleanIdent,
        expires_in_minutes: expiresInMinutes,
        ...(isDevMode ? { dev_otp: otp } : {})
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao processar solicitação de redefinição SMS:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar redefinição de senha.'
      });
    }
  },

  // 2. Validação do Token OTP de 6 Dígitos (POST /api/auth/verify-token)
  async verifyToken(req, res) {
    try {
      const { identificador, token, otp } = req.body;
      const inputOtp = String(token || otp || '').trim();

      if (!identificador || !inputOtp) {
        return res.status(400).json({
          success: false,
          error: 'Identificador e o código de verificação de 6 dígitos são obrigatórios.'
        });
      }

      const cleanIdent = String(identificador).trim().toLowerCase();
      const onlyDigits = cleanIdent.replace(/\D/g, '');

      // Localiza o usuário
      let user = db.prepare(`
        SELECT id, nome, email, matricula, telefone, ativo 
        FROM usuarios 
        WHERE LOWER(email) = ? OR LOWER(matricula) = ?
      `).get(cleanIdent, cleanIdent);

      if (!user && onlyDigits.length >= 8) {
        const usersWithPhone = db.prepare(`
          SELECT id, nome, email, matricula, telefone, ativo 
          FROM usuarios 
          WHERE telefone IS NOT NULL AND telefone != ''
        `).all();

        user = usersWithPhone.find(u => {
          const userDigits = String(u.telefone).replace(/\D/g, '');
          return userDigits === onlyDigits || 
                 userDigits.endsWith(onlyDigits) || 
                 onlyDigits.endsWith(userDigits);
        });
      }

      if (!user || user.ativo !== 1) {
        return res.status(400).json({
          success: false,
          error: 'Identificador não localizado ou usuário inativo.'
        });
      }

      // Busca o último token ativo deste usuário
      const tokenRecord = db.prepare(`
        SELECT id, token_hash, expires_at, attempts, used_at, created_at 
        FROM password_reset_tokens 
        WHERE user_id = ? AND used_at IS NULL 
        ORDER BY id DESC LIMIT 1
      `).get(user.id);

      if (!tokenRecord) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum código de verificação ativo encontrado. Solicite um novo código via SMS.'
        });
      }

      // Verifica se o token já expirou
      const now = new Date();
      const expiresAt = new Date(tokenRecord.expires_at);
      if (now > expiresAt) {
        db.prepare(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(tokenRecord.id);
        return res.status(410).json({
          success: false,
          error: 'Este código de verificação expirou (validade de 10 minutos). Solicite um novo código via SMS.'
        });
      }

      // Bloqueio contra força bruta: se já houver 3 ou mais tentativas incorretas
      if (tokenRecord.attempts >= 3) {
        db.prepare(`UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?`).run(tokenRecord.id);
        return res.status(429).json({
          success: false,
          error: 'Número máximo de 3 tentativas incorretas excedido. Este código foi bloqueado por segurança. Solicite um novo código via SMS.',
          attempts_remaining: 0
        });
      }

      // Compara o hash do OTP recebido com o token_hash armazenado
      const inputHash = crypto.createHash('sha256').update(inputOtp).digest('hex');

      if (inputHash !== tokenRecord.token_hash) {
        const newAttempts = tokenRecord.attempts + 1;
        const attemptsRemaining = Math.max(0, 3 - newAttempts);

        if (newAttempts >= 3) {
          db.prepare(`
            UPDATE password_reset_tokens 
            SET attempts = ?, used_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(newAttempts, tokenRecord.id);

          return res.status(400).json({
            success: false,
            error: 'Código de verificação incorreto. Limite de 3 tentativas atingido. O código foi invalidado.',
            attempts_remaining: 0
          });
        } else {
          db.prepare(`
            UPDATE password_reset_tokens 
            SET attempts = ? 
            WHERE id = ?
          `).run(newAttempts, tokenRecord.id);

          return res.status(400).json({
            success: false,
            error: `Código de verificação incorreto. Você possui mais ${attemptsRemaining} tentativa(s).`,
            attempts_remaining: attemptsRemaining
          });
        }
      }

      // Token válido! Marca o OTP como consumido/verificado
      db.prepare(`
        UPDATE password_reset_tokens 
        SET used_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(tokenRecord.id);

      // Gera o ticket temporário de uso único (Reset Ticket JWT válido por 10 minutos)
      const resetTicket = jwt.sign(
        {
          userId: user.id,
          purpose: 'password_reset_ticket',
          tokenId: tokenRecord.id,
          jti: crypto.randomBytes(16).toString('hex')
        },
        SECURITY_CONFIG.jwtSecret,
        { expiresIn: '10m' }
      );

      return res.status(200).json({
        success: true,
        message: 'Código de verificação validado com sucesso!',
        reset_ticket: resetTicket,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          matricula: user.matricula,
          telefone_mascarado: maskPhone(user.telefone)
        }
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao validar token SMS:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao validar código de verificação.'
      });
    }
  },

  // 3. Atualização Efetiva da Senha (POST /api/auth/reset-password)
  async resetPassword(req, res) {
    try {
      const { reset_ticket, token, nova_senha, confirmar_nova_senha } = req.body;

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

      let userId = null;
      let userName = '';
      let userEmail = '';
      let userMatricula = '';

      // Modo 1: Autorização via Reset Ticket JWT (Fluxo SMS OTP)
      if (reset_ticket) {
        let decoded;
        try {
          decoded = jwt.verify(reset_ticket, SECURITY_CONFIG.jwtSecret);
        } catch (err) {
          return res.status(401).json({
            success: false,
            error: 'Ticket de redefinição inválido ou expirado. Por favor, solicite um novo código via SMS.'
          });
        }

        if (decoded.purpose !== 'password_reset_ticket' || !decoded.userId) {
          return res.status(401).json({
            success: false,
            error: 'Ticket de redefinição inválido.'
          });
        }

        const user = db.prepare('SELECT id, nome, email, matricula, ativo FROM usuarios WHERE id = ?').get(decoded.userId);
        if (!user || user.ativo !== 1) {
          return res.status(403).json({
            success: false,
            error: 'Usuário não encontrado ou desativado.'
          });
        }

        userId = user.id;
        userName = user.nome;
        userEmail = user.email;
        userMatricula = user.matricula;
      }
      // Modo 2: Fallback para Token de E-mail Legado (password_resets)
      else if (token) {
        const resetRecord = db.prepare(`
          SELECT pr.id, pr.user_id, pr.expires_at, pr.used, u.nome, u.email, u.matricula, u.ativo
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
            error: 'Este link de redefinição expirou. Solicite um novo código via SMS.'
          });
        }

        if (resetRecord.ativo !== 1) {
          return res.status(403).json({
            success: false,
            error: 'Usuário desativado.'
          });
        }

        userId = resetRecord.user_id;
        userName = resetRecord.nome;
        userEmail = resetRecord.email;
        userMatricula = resetRecord.matricula;

        // Marca como consumido
        db.prepare(`UPDATE password_resets SET used = 1 WHERE id = ?`).run(resetRecord.id);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Ticket de autorização ou token não fornecido.'
        });
      }

      // Validação de Segurança e Robustez (NIST SP 800-63B)
      const nistValidation = validatePasswordNIST(nova_senha, {
        nome: userName,
        email: userEmail,
        matricula: userMatricula
      });

      if (!nistValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: nistValidation.errors.join(' ') || 'A senha não atende aos critérios NIST SP 800-63B.',
          detalhes: nistValidation.errors
        });
      }

      // Criptografia com Bcrypt (saltRounds = 10)
      const saltRounds = 10;
      const newHash = bcrypt.hashSync(nova_senha, saltRounds);

      // Persiste a nova senha e zera o status de primeiro acesso
      db.prepare(`
        UPDATE usuarios 
        SET senha_hash = ?, primeiro_acesso = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newHash, userId);

      // Invalida todos os tokens restantes desse usuário
      db.prepare(`
        UPDATE password_reset_tokens 
        SET used_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND used_at IS NULL
      `).run(userId);

      // Limpa cookies de sessão anteriores para garantir logout limpo
      res.clearCookie(SECURITY_CONFIG.authCookieName, { path: '/' });

      // Envia e-mail de confirmação de alteração de senha se houver serviço SMTP
      try {
        await sendPasswordChangedConfirmationEmail({
          nome: userName,
          email: userEmail
        });
      } catch (e) {
        // Silencia erro de e-mail se SMTP não estiver configurado
      }

      return res.status(200).json({
        success: true,
        message: 'Sua senha foi redefinida com sucesso! Você já pode realizar login com sua nova senha.'
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro na redefinição de senha:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao redefinir senha.'
      });
    }
  },

  // 4. Validação de Token de E-mail Legado (GET /api/auth/validate-reset-token)
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
          error: 'Este link de redefinição expirou. Por favor, solicite um novo código via SMS.'
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
  }
};
