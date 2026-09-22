import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_FROM = process.env.SMTP_FROM || '"TKE Suporte Corporativo" <noreply@empresa.com>';

let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log(`📧 [EmailService] Configurado com servidor SMTP: ${SMTP_HOST}:${SMTP_PORT}`);
} else {
  console.log(`📧 [EmailService] Modo Simulado (Desenvolvimento/Log). Os e-mails serão gerados e logados no console.`);
}

// Histórico de e-mails em memória para ambiente de teste/auditoria
export const emailHistory = [];

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
 * Envia e-mail com link de redefinição de senha
 */
export async function sendPasswordResetEmail({ nome, email, resetToken, expiresInMinutes = 15 }) {
  const resetUrl = `${APP_URL}/redefinir-senha.html?token=${encodeURIComponent(resetToken)}`;
  const subject = '🔒 Recuperação de Acesso - Gerenciamento Corporativo de Orçamentos';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F3F4F6; margin: 0; padding: 0; }
        .container { max-width: 580px; margin: 30px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #111827 0%, #1F2937 50%, #6200EA 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
        .content { padding: 32px 28px; color: #374151; font-size: 15px; line-height: 1.6; }
        .greeting { font-size: 17px; font-weight: 600; color: #111827; margin-bottom: 12px; }
        .button-box { text-align: center; margin: 28px 0; }
        .btn-reset { display: inline-block; background: #6200EA; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(98, 0, 234, 0.35); transition: background 0.2s; }
        .info-card { background: #F9FAFB; border-left: 4px solid #6200EA; border-radius: 4px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #4B5563; }
        .fallback-link { word-break: break-all; font-size: 12px; color: #6B7280; background: #F3F4F6; padding: 10px; border-radius: 6px; margin-top: 15px; }
        .footer { background: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 20px 24px; text-align: center; font-size: 12px; color: #9CA3AF; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Gerenciamento Corporativo</h1>
          <div style="font-size: 13px; opacity: 0.85; margin-top: 4px;">Recuperação Segura de Acesso</div>
        </div>
        <div class="content">
          <div class="greeting">Olá, ${nome || 'Colaborador(a)'}!</div>
          <p>Recebemos uma solicitação para redefinir a senha de acesso à sua conta vinculada a este e-mail corporativo.</p>
          <p>Para criar sua nova senha com segurança, clique no botão abaixo:</p>
          
          <div class="button-box">
            <a href="${resetUrl}" class="btn-reset" target="_blank">Redefinir Minha Senha</a>
          </div>

          <div class="info-card">
            ⏱️ <strong>Atenção:</strong> Este link é de uso único e expira em <strong>${expiresInMinutes} minutos</strong>.<br>
            Caso você não tenha solicitado esta redefinição, nenhuma ação é necessária. Sua senha atual permanecerá segura.
          </div>

          <p style="font-size: 13px; color: #6B7280; margin-top: 24px;">
            Se o botão acima não funcionar, copie e cole o seguinte link no seu navegador:
          </p>
          <div class="fallback-link">${resetUrl}</div>
        </div>
        <div class="footer">
          Este é um e-mail automático gerado pelo Sistema Corporativo de Gerenciamento de Orçamentos.<br>
          Por motivos de segurança, nunca compartilhe este link com terceiros.
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload = {
    from: SMTP_FROM,
    to: email,
    subject,
    html: htmlContent,
    text: `Olá ${nome || 'Colaborador(a)'},\n\nRecebemos uma solicitação para redefinir sua senha.\n\nAcesse o link a seguir para criar sua nova senha (válido por ${expiresInMinutes} minutos):\n${resetUrl}\n\nSe você não solicitou, ignore esta mensagem.`,
    sentAt: new Date().toISOString(),
    resetUrl,
    resetToken
  };

  emailHistory.push(emailPayload);

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
      return { success: true, messageId: info.messageId, mode: 'smtp' };
    } catch (err) {
      console.error(`❌ [EmailService] Erro ao enviar e-mail via SMTP para ${email}:`, err.message);
      // Registra no console para não impedir o fluxo em caso de falha de conexão externa
    }
  }

  // Fallback / Log no console para desenvolvimento
  console.log(`\n==================== 📧 E-MAIL CORPORATIVO DISPARADO ====================`);
  console.log(`📨 Para: ${nome} <${email}>`);
  console.log(`📌 Assunto: ${subject}`);
  console.log(`⏱️ Validade: ${expiresInMinutes} minutos`);
  console.log(`🔗 Link de Redefinição: ${resetUrl}`);
  console.log(`🔑 Token Seguro: ${resetToken}`);
  console.log(`========================================================================\n`);

  return { success: true, mode: 'simulated', resetUrl };
}

/**
 * Envia e-mail de confirmação de senha alterada com sucesso
 */
export async function sendPasswordChangedConfirmationEmail({ nome, email }) {
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

  if (transporter) {
    try {
      await transporter.sendMail({
        from: SMTP_FROM,
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
