import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { SECURITY_CONFIG } from '../config/security.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { sendPasswordResetEmail, sendPasswordChangedConfirmationEmail, maskEmail } from '../services/emailService.js';
import { sendResetOtpSms, maskPhone, formatE164 } from '../services/smsService.js';
import { validatePasswordNIST, generateSecureProvisionalPassword } from '../utils/passwordValidator.js';
import { 
  generateTotpSetup, 
  verifyTotpToken, 
  generateBackupCodes, 
  verifyAndConsumeBackupCode 
} from '../services/totpService.js';

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
  // FLUXO DE SEGURANÇA TOTP (RFC 6238) - APPS AUTENTICADORES (ZERO CUSTO)
  // =========================================================================

  // 1. Iniciar Pareamento / Setup do Autenticador (POST /api/auth/totp/setup)
  async setupTotp(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
      }

      const user = db.prepare('SELECT id, nome, email, matricula FROM usuarios WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
      }

      const setup = await generateTotpSetup(user.email, user.nome);

      db.prepare('UPDATE usuarios SET totp_temp_secret = ? WHERE id = ?').run(setup.secret, user.id);

      return res.status(200).json({
        success: true,
        qr_code: setup.qrCodeDataUrl,
        manual_key: setup.manualKey,
        otpauth_url: setup.otpauthUrl,
        account: user.email,
        issuer: 'TKE Orçamentos'
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao gerar setup TOTP:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar QR Code de pareamento TOTP.'
      });
    }
  },

  // 2. Confirmação do 1º código TOTP e Entrega de Códigos de Backup (POST /api/auth/totp/confirm)
  async confirmTotp(req, res) {
    try {
      const userId = req.user?.id;
      const { code } = req.body;
      const inputCode = String(code || '').trim();

      if (!userId || !inputCode) {
        return res.status(400).json({
          success: false,
          error: 'Código de 6 dígitos é obrigatório para confirmar o pareamento.'
        });
      }

      const user = db.prepare('SELECT id, nome, email, totp_temp_secret FROM usuarios WHERE id = ?').get(userId);
      if (!user || !user.totp_temp_secret) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum pareamento TOTP pendente encontrado. Inicie a configuração novamente.'
        });
      }

      const isValid = verifyTotpToken(inputCode, user.totp_temp_secret);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Código incorreto. Certifique-se de digitar o código de 6 dígitos gerado pelo seu app autenticador.'
        });
      }

      // Gera 8 códigos de backup de emergência (XXXX-XXXX)
      const { rawCodes, hashedCodes } = generateBackupCodes(8);

      db.prepare(`
        UPDATE usuarios 
        SET totp_secret = totp_temp_secret,
            totp_enabled = 1,
            totp_backup_codes = ?,
            totp_temp_secret = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(hashedCodes), user.id);

      console.log(`✅ [TOTP Confirm] Autenticador pareado com sucesso para ${user.email} (ID: ${user.id}).`);

      return res.status(200).json({
        success: true,
        message: 'Aplicativo autenticador pareado com sucesso!',
        backup_codes: rawCodes
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao confirmar TOTP:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao confirmar pareamento TOTP.'
      });
    }
  },

  // 3. Status da ativação TOTP do usuário (GET /api/auth/totp/status)
  async getTotpStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }

      const user = db.prepare('SELECT totp_enabled, totp_backup_codes FROM usuarios WHERE id = ?').get(userId);
      let remainingBackups = 0;
      if (user?.totp_backup_codes) {
        try {
          remainingBackups = JSON.parse(user.totp_backup_codes).length;
        } catch {}
      }

      return res.status(200).json({
        success: true,
        totp_enabled: Boolean(user?.totp_enabled),
        backup_codes_remaining: remainingBackups
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Erro ao consultar status TOTP.' });
    }
  },

  // 4. Solicitação de Redefinição de Senha via TOTP (POST /api/auth/forgot-password)
  // 100% Zero Disparos Externos: utiliza unicamente o App Autenticador
  async forgotPassword(req, res) {
    try {
      const { identificador } = req.body;
      if (!identificador) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe seu identificador (E-mail corporativo ou Matrícula).'
        });
      }

      const cleanIdent = String(identificador).trim().toLowerCase();

      // Localiza o usuário por e-mail ou matrícula
      const user = db.prepare(`
        SELECT id, nome, email, matricula, totp_enabled, ativo 
        FROM usuarios 
        WHERE LOWER(email) = ? OR LOWER(matricula) = ?
      `).get(cleanIdent, cleanIdent);

      // Prevenção de enumeração de contas
      if (!user || user.ativo !== 1) {
        return res.status(200).json({
          success: true,
          channel: 'totp',
          totp_enabled: true,
          identificador: cleanIdent,
          message: 'Abra seu aplicativo autenticador (Google Authenticator, Apple Passwords ou Authy) e digite o código de 6 dígitos.'
        });
      }

      // Se o usuário ainda não tiver TOTP pareado, gera o QR Code no primeiro acesso
      if (!user.totp_enabled) {
        const setup = await generateTotpSetup(user.email, user.nome);
        db.prepare('UPDATE usuarios SET totp_temp_secret = ? WHERE id = ?').run(setup.secret, user.id);

        return res.status(200).json({
          success: true,
          channel: 'totp',
          totp_enabled: false,
          needs_setup: true,
          qr_code: setup.qrCodeDataUrl,
          manual_key: setup.manualKey,
          identificador: cleanIdent,
          user_name: user.nome,
          account: user.email,
          message: 'Como este é seu primeiro acesso, escaneie o QR Code abaixo no seu app autenticador.'
        });
      }

      return res.status(200).json({
        success: true,
        channel: 'totp',
        totp_enabled: true,
        identificador: cleanIdent,
        user_name: user.nome,
        message: 'Abra seu aplicativo autenticador e digite o código de 6 dígitos para redefinir sua senha.'
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao processar solicitação de redefinição TOTP:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao processar redefinição de senha.'
      });
    }
  },

  // 5. Validação do Código TOTP (6 dígitos) ou Código de Backup (8 chars) (POST /api/auth/verify-token)
  async verifyToken(req, res) {
    try {
      const { identificador, token, otp, code } = req.body;
      const inputCode = String(token || otp || code || '').trim();

      if (!identificador || !inputCode) {
        return res.status(400).json({
          success: false,
          error: 'Identificador e o código do aplicativo autenticador são obrigatórios.'
        });
      }

      const cleanIdent = String(identificador).trim().toLowerCase();

      // Localiza o usuário
      const user = db.prepare(`
        SELECT id, nome, email, matricula, totp_secret, totp_enabled, totp_backup_codes, totp_temp_secret, ativo 
        FROM usuarios 
        WHERE LOWER(email) = ? OR LOWER(matricula) = ?
      `).get(cleanIdent, cleanIdent);

      if (!user || user.ativo !== 1) {
        return res.status(400).json({
          success: false,
          error: 'Identificador não localizado ou usuário inativo.'
        });
      }

      let isValid = false;
      let isBackupCode = false;
      let remainingBackupCount = 0;

      // Caso A: Usuário com TOTP ativo
      if (user.totp_enabled && user.totp_secret) {
        const cleanDigits = inputCode.replace(/\D/g, '');
        
        // 1. Tenta código TOTP de 6 dígitos
        if (cleanDigits.length === 6) {
          isValid = verifyTotpToken(cleanDigits, user.totp_secret);
        }

        // 2. Se falhou e tem códigos de backup cadastrados, tenta validar como código de backup
        if (!isValid && user.totp_backup_codes) {
          const backupCheck = verifyAndConsumeBackupCode(inputCode, user.totp_backup_codes);
          if (backupCheck.valid) {
            isValid = true;
            isBackupCode = true;
            remainingBackupCount = backupCheck.remainingHashes.length;
            db.prepare('UPDATE usuarios SET totp_backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(JSON.stringify(backupCheck.remainingHashes), user.id);
            console.log(`🔐 [TOTP Backup] Código de backup utilizado para ${user.email}. Restam ${remainingBackupCount}.`);
          }
        }
      } 
      // Caso B: Primeiro Pareamento Pendente (totp_enabled === 0 com totp_temp_secret)
      else if (user.totp_temp_secret) {
        const cleanDigits = inputCode.replace(/\D/g, '');
        if (cleanDigits.length === 6) {
          isValid = verifyTotpToken(cleanDigits, user.totp_temp_secret);
          if (isValid) {
            const { hashedCodes } = generateBackupCodes(8);
            db.prepare(`
              UPDATE usuarios 
              SET totp_secret = totp_temp_secret, 
                  totp_enabled = 1, 
                  totp_backup_codes = ?, 
                  totp_temp_secret = NULL, 
                  updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(JSON.stringify(hashedCodes), user.id);
          }
        }
      }

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Código incorreto ou expirado. Verifique o código de 6 dígitos no seu app autenticador ou utilize um Código de Backup.'
        });
      }

      // Emite Reset Ticket JWT seguro com validade de 10 minutos
      const resetTicket = jwt.sign(
        {
          userId: user.id,
          purpose: 'password_reset_ticket',
          jti: crypto.randomBytes(16).toString('hex')
        },
        SECURITY_CONFIG.jwtSecret,
        { expiresIn: '10m' }
      );

      return res.status(200).json({
        success: true,
        message: isBackupCode 
          ? `Código de backup aceito com sucesso! (Restam ${remainingBackupCount} códigos de emergência).`
          : 'Autenticação em 2 etapas confirmada com sucesso!',
        reset_ticket: resetTicket,
        is_backup_code: isBackupCode,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          matricula: user.matricula
        }
      });
    } catch (error) {
      console.error('❌ [Auth Controller] Erro ao validar token TOTP:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro interno ao validar código de segurança.'
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
        error: error.message || 'Erro interno ao redefinir senha.'
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
  },

  // 5. Status da Conexão do WhatsApp & QR Code (GET /api/auth/whatsapp-status)
  async getWhatsAppStatus(req, res) {
    try {
      const apiUrl = process.env.WHATSAPP_API_URL;
      const apiKey = process.env.WHATSAPP_API_KEY;
      const instance = process.env.WHATSAPP_INSTANCE || 'tke_orcamentos';

      if (!apiUrl || !apiKey) {
        return res.status(200).json({
          success: true,
          configured: false,
          state: 'UNCONFIGURED',
          message: 'Servidor WhatsApp não configurado no .env'
        });
      }

      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

      // 1. Verifica estado de conexão atual com timeout rápido de 4s
      try {
        const stateRes = await fetch(`${cleanUrl}/instance/connectionState/${instance}`, {
          headers: { 'apikey': apiKey },
          signal: AbortSignal.timeout(4000)
        });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          const currentState = stateData?.instance?.state || stateData?.state;
          if (currentState === 'open' || currentState === 'connected') {
            return res.status(200).json({
              success: true,
              configured: true,
              state: 'CONNECTED',
              instance,
              message: 'WhatsApp conectado e operacional!'
            });
          }
        }
      } catch (stateErr) {
        // Prossegue para tentativa de conectar / gerar QR Code
      }

      // 2. Solicita QR Code / Conexão
      const connectRes = await fetch(`${cleanUrl}/instance/connect/${instance}`, {
        headers: { 'apikey': apiKey },
        signal: AbortSignal.timeout(5000)
      });
      
      const connectText = await connectRes.text();
      let connectData = {};
      try {
        connectData = JSON.parse(connectText);
      } catch (e) {
        connectData = { raw: connectText };
      }

      let state = connectData?.instance?.state || connectData?.state || 'connecting';
      let qrcode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.code || null;

      if (state === 'open' || state === 'connected') {
        return res.status(200).json({
          success: true,
          configured: true,
          state: 'CONNECTED',
          instance,
          message: 'WhatsApp conectado e operacional!'
        });
      }

      return res.status(200).json({
        success: true,
        configured: true,
        state: String(state).toUpperCase(),
        instance,
        qrcode,
        message: qrcode ? 'Aguardando leitura do QR Code pelo WhatsApp.' : 'Instância em inicialização no servidor.'
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        configured: true,
        state: 'FALLBACK',
        message: 'Servidor de envio direto em standby. O envio por Link Direto wa.me está ativo.',
        error: err.message
      });
    }
  }
};
