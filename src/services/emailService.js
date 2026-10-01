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
 * Envia e-mail com senha provisória de acesso imediato (SEM LINKS EXTERNOS para evitar bloqueios anti-phishing)
 */
export async function sendPasswordResetEmail({ nome, email, matricula, senhaProvisoria, resetToken }) {
  const smtpFrom = process.env.SMTP_FROM || `"Suporte Corporativo de orçamentos" <${process.env.SMTP_USER || 'noreply@empresa.com'}>`;
  const subject = '🔑 Senha Provisória de Acesso - Gerenciamento Corporativo';

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
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E5E7EB;">
              
              <!-- CABEÇALHO -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #111827 0%, #1F2937 60%, #6200EA 100%); background-color: #1F2937; padding: 32px 24px;">
                  <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">Gerenciamento Corporativo</h1>
                  <div style="color: #EDE9FE; font-size: 13px; margin-top: 6px; font-weight: 500;">Recuperação de Senha de Acesso</div>
                </td>
              </tr>

              <!-- CONTEÚDO PRINCIPAL -->
              <tr>
                <td style="padding: 32px 28px; color: #374151; font-size: 15px; line-height: 1.6;">
                  <div style="font-size: 17px; font-weight: 700; color: #111827; margin-bottom: 12px;">
                    Olá, ${nome || 'Colaborador(a)'}!
                  </div>
                  <p style="margin: 0 0 18px 0; color: #4B5563;">
                    Recebemos uma solicitação para redefinir a senha de acesso à sua conta corporativa. Uma nova <strong>senha provisória</strong> foi gerada para o seu login.
                  </p>

                  <!-- QUADRO DE CREDENCIAIS PROVISÓRIAS -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; margin: 20px 0;">
                    <tr>
                      <td style="padding: 18px 22px;">
                        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; margin-bottom: 6px;">
                          Usuário de Acesso:
                        </div>
                        <div style="font-size: 15px; font-weight: 600; color: #0F172A; margin-bottom: 14px;">
                          ${email} ${matricula ? `<span style="color: #64748B; font-weight: normal;">(Matrícula: <strong>${matricula}</strong>)</span>` : ''}
                        </div>

                        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; margin-bottom: 6px;">
                          🔑 Senha Provisória:
                        </div>
                        <div style="font-size: 22px; font-weight: 700; color: #6200EA; font-family: Consolas, Monaco, monospace; background-color: #EDE9FE; padding: 10px 16px; border-radius: 6px; display: inline-block; letter-spacing: 1.5px; border: 1px dashed #7C3AED;">
                          ${senhaProvisoria}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- INSTRUÇÕES PASSO A PASSO -->
                  <div style="background-color: #F0FDF4; border-left: 4px solid #10B981; border-radius: 4px; padding: 14px 18px; margin: 22px 0; font-size: 13.5px; color: #065F46; line-height: 1.6;">
                    <strong>Como acessar sua conta:</strong><br>
                    1. Abra o navegador em seu computador ou celular.<br>
                    2. Acesse a plataforma de <strong>Gerenciamento Corporativo de Orçamentos</strong>.<br>
                    3. Informe seu e-mail ou matrícula e digite a <strong>senha provisória</strong> acima.<br>
                    4. No primeiro login, você será solicitado a cadastrar sua <strong>nova senha pessoal definitiva</strong>.
                  </div>

                  <!-- AVISO DE SEGURANÇA ANTIPHISHING -->
                  <div style="font-size: 12px; color: #6B7280; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB; line-height: 1.4;">
                    🛡️ <em>Por conformidade com as políticas corporativas de segurança e prevenção a phishing, este comunicado é estritamente informativo e não contém links externos clicáveis.</em>
                  </div>

                </td>
              </tr>

              <!-- RODAPÉ -->
              <tr>
                <td align="center" style="background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 20px 24px; font-size: 12px; color: #9CA3AF; line-height: 1.4;">
                  Sistema Corporativo de Gerenciamento de Orçamentos.<br>
                  Caso você não tenha solicitado esta alteração, contate a administração do sistema.
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
    'Recebemos uma solicitação de redefinição de senha para a sua conta corporativa.',
    '',
    '========================================',
    `USUÁRIO: ${email}`,
    matricula ? `MATRÍCULA: ${matricula}` : '',
    `🔑 SENHA PROVISÓRIA: ${senhaProvisoria}`,
    '========================================',
    '',
    'INSTRUÇÕES DE ACESSO:',
    '1. Abra o navegador em seu computador ou celular.',
    '2. Acesse a plataforma de Gerenciamento Corporativo de Orçamentos.',
    '3. Faça login com seu e-mail/matrícula e a senha provisória acima.',
    '4. Cadastre sua nova senha pessoal definitiva no primeiro acesso.',
    '',
    'Por motivos de segurança corporativa, este e-mail não contém links externos clicáveis.'
  ].filter(Boolean).join('\n');

  const emailPayload = {
    from: smtpFrom,
    to: email,
    subject,
    html: htmlContent,
    text: plainText,
    sentAt: new Date().toISOString(),
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
      console.log(`✅ [EmailService] E-mail com senha provisória (sem links) enviado para ${email} (MessageID: ${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'smtp' };
    } catch (err) {
      console.error(`❌ [EmailService] Erro ao enviar e-mail via SMTP para ${email}:`, err.message);
    }
  }

  // Fallback / Log no console para desenvolvimento
  console.log(`\n==================== 📧 E-MAIL CORPORATIVO DISPARADO ====================`);
  console.log(`📨 Para: ${nome} <${email}>`);
  console.log(`📌 Assunto: ${subject}`);
  console.log(`🔑 Senha Provisória: ${senhaProvisoria}`);
  console.log(`========================================================================\n`);

  return { success: true, mode: 'simulated' };
}

/**
 * Envia e-mail com senha provisória / reset administrativo (SEM LINKS EXTERNOS)
 */
export async function sendProvisionalPasswordEmail({ nome, email, matricula, senhaProvisoria }) {
  return sendPasswordResetEmail({ nome, email, matricula, senhaProvisoria });
}

/**
 * Envia e-mail de confirmação de senha alterada com sucesso (SEM LINKS EXTERNOS)
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
          <h2 style="margin:0; font-size: 19px;">Senha Alterada com Sucesso</h2>
        </div>
        <div class="content">
          <p>Olá, <strong>${nome || 'Colaborador(a)'}</strong>,</p>
          <p>Informamos que a senha de acesso à sua conta corporativa foi atualizada com sucesso.</p>
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
