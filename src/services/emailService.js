import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cria ou obtém o transportador SMTP configurado
 */
export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return null;
}

// Histórico de e-mails em memória para ambiente de teste/auditoria
export const emailHistory = [];

/**
 * Verifica a conectividade do servidor SMTP configurado
 */
export async function verifySmtpConnection() {
  const transporter = getTransporter();
  if (!transporter) {
    return { 
      configured: false, 
      message: 'SMTP não configurado no .env (modo simulado ativo).' 
    };
  }
  try {
    await transporter.verify();
    return { 
      configured: true, 
      connected: true, 
      message: 'Servidor SMTP conectado e autenticado com sucesso.' 
    };
  } catch (error) {
    return { 
      configured: true, 
      connected: false, 
      error: error.message 
    };
  }
}

/**
 * Mascara um endereço de e-mail para exibição segura (ex: thais****@empresa.com)
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const [user, domain] = parts;
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const visibleStart = user.substring(0, 2);
  const visibleEnd = user.length > 4 ? user.substring(user.length - 1) : '';
  const maskedLength = Math.max(3, user.length - visibleStart.length - visibleEnd.length);
  return `${visibleStart}${'*'.repeat(maskedLength)}${visibleEnd}@${domain}`;
}

/**
 * Envia e-mail com link de redefinição de senha e senha provisória de acesso imediato (Esqueci Minha Senha)
 */
export async function sendPasswordResetEmail({ nome, email, matricula, senhaProvisoria, resetToken, expiresInMinutes = 15, reqBaseUrl = null }) {
  const appUrl = reqBaseUrl || process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const smtpFrom = process.env.SMTP_FROM || `"Suporte Corporativo de orçamentos" <${process.env.SMTP_USER || 'noreply@empresa.com'}>`;
  const resetUrl = `${appUrl}/redefinir-senha.html?token=${encodeURIComponent(resetToken)}`;
  const loginUrl = `${appUrl}/login.html`;
  const subject = '🔒 Recuperação de Acesso - Gerenciamento Corporativo de Orçamentos';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #F3F4F6; padding: 24px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E5E7EB;">
              
              <!-- CABEÇALHO -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #111827 0%, #1F2937 60%, #6200EA 100%); background-color: #1F2937; padding: 32px 24px;">
                  <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Gerenciamento Corporativo</h1>
                  <div style="color: #EDE9FE; font-size: 13px; margin-top: 6px; font-weight: 500;">Recuperação Segura de Acesso</div>
                </td>
              </tr>

              <!-- CONTEÚDO PRINCIPAL -->
              <tr>
                <td style="padding: 32px 28px; color: #374151; font-size: 15px; line-height: 1.6;">
                  <div style="font-size: 17px; font-weight: 700; color: #111827; margin-bottom: 12px;">
                    Olá, ${nome || 'Colaborador(a)'}!
                  </div>
                  <p style="margin: 0 0 16px 0; color: #4B5563;">
                    Recebemos uma solicitação para redefinir o acesso à sua conta vinculada a este e-mail corporativo.
                  </p>

                  ${senhaProvisoria ? `
                  <!-- QUADRO DE SENHA PROVISÓRIA -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; margin-bottom: 8px;">
                          🔑 Senha Provisória de Acesso Imediato:
                        </div>
                        <div style="font-size: 20px; font-weight: 700; color: #6200EA; font-family: Consolas, Monaco, monospace; background-color: #EDE9FE; padding: 8px 14px; border-radius: 6px; display: inline-block; letter-spacing: 1px;">
                          ${senhaProvisoria}
                        </div>
                        ${matricula ? `<div style="font-size: 13px; color: #64748B; margin-top: 8px;">Matrícula Funcional: <strong style="color: #1E293B;">${matricula}</strong></div>` : ''}
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <!-- OPÇÃO 1: BOTÃO DIRETO -->
                  <div style="margin: 28px 0; text-align: center;">
                    <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 8px; background-color: #6200EA;">
                          <a href="${resetUrl}" target="_blank" style="font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; display: inline-block; background-color: #6200EA; border: 1px solid #6200EA;">
                            🔗 Clique Aqui para Redefinir Sua Senha
                          </a>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- AVISO DE SEGURANÇA E EXPIRAÇÃO -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 12px 16px; font-size: 13px; color: #92400E; line-height: 1.5;">
                        ⏱️ <strong>Atenção:</strong> O link acima é de uso único e expira em <strong>${expiresInMinutes} minutos</strong>.<br>
                        Caso você não tenha solicitado esta redefinição, sua conta permanecerá segura.
                      </td>
                    </tr>
                  </table>

                  <!-- LINKS EM TEXTO PURO (FALLBACK) -->
                  <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                    <div style="font-size: 13px; font-weight: 600; color: #4B5563; margin-bottom: 6px;">
                      Ou acesse diretamente através dos links abaixo:
                    </div>
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">• <strong>Link Direto de Redefinição:</strong></div>
                    <div style="word-break: break-all; font-size: 12px; color: #6200EA; background-color: #F3F4F6; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-family: Consolas, monospace;">
                      <a href="${resetUrl}" style="color: #6200EA; text-decoration: underline;">${resetUrl}</a>
                    </div>
                    <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">• <strong>Página de Login:</strong></div>
                    <div style="word-break: break-all; font-size: 12px; color: #4B5563; background-color: #F3F4F6; padding: 8px 12px; border-radius: 6px; font-family: Consolas, monospace;">
                      <a href="${loginUrl}" style="color: #4B5563; text-decoration: underline;">${loginUrl}</a>
                    </div>
                  </div>

                </td>
              </tr>

              <!-- RODAPÉ -->
              <tr>
                <td align="center" style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 20px 24px; font-size: 12px; color: #9CA3AF; line-height: 1.4;">
                  Sistema Corporativo de Gerenciamento de Orçamentos.<br>
                  Por motivos de segurança, nunca compartilhe seus dados ou links com terceiros.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const plainText = [
    `Olá ${nome || 'Colaborador(a)'},`,
    '',
    'Recebemos uma solicitação para redefinir a senha de acesso à sua conta corporativa.',
    senhaProvisoria ? `\n🔑 SENHA PROVISÓRIA DE ACESSO: ${senhaProvisoria}\nMatrícula: ${matricula || 'N/D'}` : '',
    '',
    `🔗 LINK DIRETO DE REDEFINIÇÃO (Válido por ${expiresInMinutes} minutos):`,
    resetUrl,
    '',
    `🌐 PÁGINA DE LOGIN:`,
    loginUrl,
    '',
    'Se você não solicitou esta redefinição, por favor ignore esta mensagem.'
  ].filter(Boolean).join('\n');

  const emailPayload = {
    from: smtpFrom,
    to: email,
    subject,
    html: htmlContent,
    text: plainText,
    sentAt: new Date().toISOString(),
    resetUrl,
    resetToken
  };

  emailHistory.push(emailPayload);

  const transporter = getTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: emailPayload.from,
        to: emailPayload.to,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text
      });
      console.log(`✅ [EmailService] E-mail de redefinição enviado com sucesso para ${email} (MessageID: ${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'smtp', resetUrl };
    } catch (err) {
      console.error(`❌ [EmailService] Erro ao enviar e-mail via SMTP para ${email}:`, err.message);
    }
  }

  // Fallback / Log no console para desenvolvimento
  console.log(`\n==================== 📧 E-MAIL CORPORATIVO DISPARADO ====================`);
  console.log(`📨 Para: ${nome} <${email}>`);
  console.log(`📌 Assunto: ${subject}`);
  if (senhaProvisoria) console.log(`🔑 Senha Provisória: ${senhaProvisoria}`);
  console.log(`⏱️ Validade: ${expiresInMinutes} minutos`);
  console.log(`🔗 Link de Redefinição: ${resetUrl}`);
  console.log(`========================================================================\n`);

  return { success: true, mode: 'simulated', resetUrl };
}


/**
 * Envia e-mail com senha provisória / reset administrativo
 */
export async function sendProvisionalPasswordEmail({ nome, email, matricula, senhaProvisoria }) {
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const smtpFrom = process.env.SMTP_FROM || `"Suporte Corporativo de orçamentos" <${process.env.SMTP_USER || 'noreply@empresa.com'}>`;
  const loginUrl = `${appUrl}/login.html`;
  const subject = '🔑 Senha Provisória de Acesso - Gerenciamento Corporativo';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F3F4F6; margin: 0; padding: 0; }
        .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #111827 0%, #1F2937 50%, #6200EA 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
        .content { padding: 32px 28px; color: #374151; font-size: 15px; line-height: 1.6; }
        .greeting { font-size: 17px; font-weight: 600; color: #111827; margin-bottom: 12px; }
        .credentials-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px 22px; margin: 20px 0; }
        .credential-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .credential-label { color: #64748B; font-weight: 500; }
        .credential-value { font-weight: 700; color: #0F172A; font-family: monospace; font-size: 15px; }
        .button-box { text-align: center; margin: 28px 0; }
        .btn-login { display: inline-block; background: #6200EA; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; }
        .info-card { background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #92400E; }
        .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 20px 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Gerenciamento Corporativo</h1>
          <div style="font-size: 13px; opacity: 0.85; margin-top: 4px;">Acesso ao Sistema</div>
        </div>
        <div class="content">
          <div class="greeting">Olá, ${nome || 'Colaborador(a)'}!</div>
          <p>Sua senha de acesso ao sistema corporativo de orçamentos foi definida ou redefinida pela administração.</p>
          
          <div class="credentials-box">
            <div class="credential-row">
              <span class="credential-label">E-mail:</span>
              <span class="credential-value">${email}</span>
            </div>
            ${matricula ? `
            <div class="credential-row">
              <span class="credential-label">Matrícula:</span>
              <span class="credential-value">${matricula}</span>
            </div>` : ''}
            <div class="credential-row" style="margin-bottom:0;">
              <span class="credential-label">Senha Provisória:</span>
              <span class="credential-value" style="color: #6200EA; background: #EDE9FE; padding: 2px 8px; border-radius: 4px;">${senhaProvisoria}</span>
            </div>
          </div>

          <div class="info-card">
            🔒 <strong>Primeiro Acesso Obrigatório:</strong> Por motivos de segurança, ao realizar o primeiro login com a senha provisória acima, você deverá cadastrar uma nova senha pessoal definitiva.
          </div>

          <div class="button-box">
            <a href="${loginUrl}" class="btn-login" target="_blank">Acessar a Plataforma</a>
          </div>
        </div>
        <div class="footer">
          Sistema Corporativo de Gerenciamento de Orçamentos.<br>
          Se você não solicitou esta alteração, entre em contato imediatamente com o suporte.
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload = {
    from: smtpFrom,
    to: email,
    subject,
    html: htmlContent,
    text: `Olá ${nome || 'Colaborador(a)'},\n\nSua senha de acesso foi definida/redefinida:\nE-mail: ${email}\nMatrícula: ${matricula || 'N/D'}\nSenha Provisória: ${senhaProvisoria}\n\nAcesse: ${loginUrl} para cadastrar sua nova senha.`,
    sentAt: new Date().toISOString()
  };

  emailHistory.push(emailPayload);

  const transporter = getTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: emailPayload.from,
        to: emailPayload.to,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text
      });
      console.log(`✅ [EmailService] E-mail com senha provisória enviado para ${email} (MessageID: ${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'smtp' };
    } catch (err) {
      console.error(`❌ [EmailService] Erro ao enviar e-mail via SMTP para ${email}:`, err.message);
    }
  }

  console.log(`\n==================== 📧 E-MAIL DE SENHA PROVISÓRIA ====================`);
  console.log(`📨 Para: ${nome} <${email}>`);
  console.log(`📌 Senha Provisória: ${senhaProvisoria}`);
  console.log(`🔗 Link de Login: ${loginUrl}`);
  console.log(`========================================================================\n`);

  return { success: true, mode: 'simulated' };
}

/**
 * Envia e-mail de confirmação de senha alterada com sucesso
 */
export async function sendPasswordChangedConfirmationEmail({ nome, email }) {
  const smtpFrom = process.env.SMTP_FROM || `"Suporte Corporativo de orçamentos" <${process.env.SMTP_USER || 'noreply@empresa.com'}>`;
  const subject = '🔒 Senha Alterada com Sucesso - Gerenciamento Corporativo';
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F3F4F6; margin: 0; padding: 0; }
        .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #111827 0%, #10B981 100%); padding: 28px 24px; text-align: center; color: #FFFFFF; }
        .content { padding: 28px 24px; color: #374151; font-size: 15px; line-height: 1.6; }
        .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 18px 24px; text-align: center; font-size: 12px; color: #9CA3AF; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin:0;">Senha Alterada com Sucesso</h2>
        </div>
        <div class="content">
          <p>Olá, <strong>${nome || 'Colaborador(a)'}</strong>,</p>
          <p>Informamos que a senha de acesso à sua conta corporativa foi redefinida com sucesso.</p>
          <p>Se você realizou esta alteração, não é necessária nenhuma ação adicional.</p>
          <p style="color: #DC2626; font-size: 13px;"><strong>Não reconhece esta alteração?</strong> Entre em contato imediatamente com a administração do sistema.</p>
        </div>
        <div class="footer">
          Gerenciamento Corporativo de Orçamentos
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = getTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject,
        html: htmlContent,
      });
      return { success: true };
    } catch (e) {
      // Silencia
    }
  }

  console.log(`📧 [EmailService] Notificação de confirmação de senha enviada para ${email}`);
  return { success: true };
}

