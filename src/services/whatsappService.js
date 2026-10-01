import dotenv from 'dotenv';
dotenv.config();

/**
 * Histórico de disparos de WhatsApp em memória para auditoria e ambiente de testes
 */
export const whatsappHistory = [];

/**
 * Formata qualquer número de telefone brasileiro para o formato padrão do WhatsApp (55119XXXXXXXX)
 * @param {string|number} phone 
 * @returns {string} Número no formato WhatsApp (ex: 5511959422857)
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Se já possui código do Brasil (55) com 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Se possui 10 ou 11 dígitos com DDD (ex: 11959422857)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se possui 8 ou 9 dígitos sem DDD (ex: 959422857), aplica DDD 11 padrão
  if (digits.length === 8 || digits.length === 9) {
    const ddd11 = digits.length === 8 ? `9${digits}` : digits;
    return `5511${ddd11}`;
  }

  return digits;
}

/**
 * Mascara o número de telefone para exibição segura no frontend (ex: (11) 9****-2857)
 * @param {string} phone 
 * @returns {string} Telefone mascarado
 */
export function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  let cleanNumber = digits;
  if (cleanNumber.startsWith('55') && cleanNumber.length > 11) {
    cleanNumber = cleanNumber.substring(2);
  }

  if (cleanNumber.length < 10) {
    const visibleStart = cleanNumber.substring(0, 2);
    const visibleEnd = cleanNumber.substring(cleanNumber.length - 2);
    return `${visibleStart}****${visibleEnd}`;
  }

  const ddd = cleanNumber.substring(0, 2);
  const isNineDigits = cleanNumber.length >= 11;
  const numBody = isNineDigits ? cleanNumber.substring(2, 11) : cleanNumber.substring(2, 10);

  if (isNineDigits) {
    const firstDigit = numBody.substring(0, 1);
    const lastDigits = numBody.substring(numBody.length - 4);
    return `(${ddd}) ${firstDigit}****-${lastDigits}`;
  } else {
    const firstDigit = numBody.substring(0, 1);
    const lastDigits = numBody.substring(numBody.length - 4);
    return `(${ddd}) ${firstDigit}***-${lastDigits}`;
  }
}

/**
 * Monta o texto corporativo formatado para envio no WhatsApp
 */
export function buildWhatsAppOtpMessage({ nome, otp, expiresInMinutes = 10 }) {
  return `🏢 *TKE - Gerenciamento de Orçamentos*
Olá, *${nome || 'Colaborador'}*!

🔐 Seu código de verificação para redefinição de senha é:
👉 *${otp}*

⏱️ Este código é de uso único e válido por *${expiresInMinutes} minutos*.
⚠️ Por segurança, nunca compartilhe este código com outras pessoas.`;
}

/**
 * Envia o código OTP para o WhatsApp do usuário cadastrado
 * Suporta Evolution API, Z-API, Webhooks e Mock Dev
 * @param {Object} params
 * @param {string} params.nome Nome do colaborador
 * @param {string} params.telefone Telefone/Celular cadastrado
 * @param {string} params.otp Código OTP de 6 dígitos
 * @param {number} [params.expiresInMinutes=10] Validade em minutos
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, maskedPhone: string, waMeUrl: string }>}
 */
export async function sendResetOtpWhatsapp({ nome, telefone, otp, expiresInMinutes = 10 }) {
  const waNumber = formatWhatsAppNumber(telefone);
  const maskedPhone = maskPhone(telefone);
  const messageText = buildWhatsAppOtpMessage({ nome, otp, expiresInMinutes });
  const waMeUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(messageText)}`;

  const apiUrl = process.env.WHATSAPP_API_URL || 'https://gerenciador-de-orcamentos-d0yc.onrender.com';
  const apiKey = process.env.WHATSAPP_API_KEY || 'TkeOrcamentos2026@SecureKey';
  const instanceName = process.env.WHATSAPP_INSTANCE || 'tke_orcamentos';
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;

  const record = {
    id: `wpp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    nome,
    telefoneOriginal: telefone,
    waNumber,
    maskedPhone,
    otp,
    messageText,
    waMeUrl,
    status: 'SENT',
    sentAt: new Date().toISOString()
  };

  // 1. Integração com Evolution API (V1 / V2) ou Z-API se configurada
  if (apiUrl && apiKey) {
    try {
      const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const endpoint = `${cleanUrl}/message/sendText/${instanceName}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: waNumber,
          text: messageText,
          options: {
            delay: 1200,
            presence: 'composing',
            linkPreview: false
          }
        }),
        signal: AbortSignal.timeout(3500)
      });

      const responseText = await response.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { raw: responseText };
      }

      if (response.ok && (data?.key?.id || data?.id || data?.status === 'PENDING' || data?.status === 'SUCCESS')) {
        record.provider = 'evolution_api';
        record.messageId = data?.key?.id || data?.id || record.id;
        record.status = 'DELIVERED_EVOLUTION';
        whatsappHistory.push(record);

        console.log(`💬 [WhatsApp Service: Evolution API] Mensagem enviada para ${maskedPhone} (${waNumber})`);
        return {
          success: true,
          provider: 'evolution_api',
          messageId: record.messageId,
          maskedPhone,
          waMeUrl
        };
      } else {
        console.warn('⚠️ [WhatsApp Service: Evolution API] Resposta não OK ou instância desconectada:', data);
      }
    } catch (err) {
      console.warn('⚠️ [WhatsApp Service: Evolution API] Falha ou timeout no envio direto via API:', err.message);
    }
  }

  // 2. Integração com Webhook genérico (n8n / Make / Typebot / Z-API)
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PASSWORD_RESET_OTP',
          number: waNumber,
          nome,
          otp,
          expiresInMinutes,
          message: messageText
        })
      });

      if (response.ok) {
        record.provider = 'webhook';
        record.status = 'DELIVERED_WEBHOOK';
        whatsappHistory.push(record);
        console.log(`💬 [WhatsApp Service: Webhook] Disparo efetuado para ${maskedPhone}`);
        return {
          success: true,
          provider: 'webhook',
          messageId: record.id,
          maskedPhone,
          waMeUrl
        };
      }
    } catch (err) {
      console.error('❌ [WhatsApp Service: Webhook] Erro ao disparar webhook:', err.message);
    }
  }

  // 3. Integração com CallMeBot (100% Gratuito - sem necessidade de servidor próprio)
  const callmebotKey = process.env.CALLMEBOT_API_KEY;
  if (callmebotKey) {
    try {
      const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=+${waNumber}&text=${encodeURIComponent(messageText)}&apikey=${callmebotKey}`;
      const response = await fetch(callmebotUrl);
      if (response.ok) {
        record.provider = 'callmebot';
        record.status = 'DELIVERED_CALLMEBOT';
        whatsappHistory.push(record);
        console.log(`💬 [WhatsApp Service: CallMeBot] Mensagem enviada para ${maskedPhone} (${waNumber})`);
        return {
          success: true,
          provider: 'callmebot',
          messageId: record.id,
          maskedPhone,
          waMeUrl
        };
      }
    } catch (err) {
      console.error('❌ [WhatsApp Service: CallMeBot] Erro no envio:', err.message);
    }
  }

  // 4. Modo Link Direto wa.me / Simulação Segura (100% Grátis)
  record.provider = 'direct_whatsapp';
  whatsappHistory.push(record);

  console.log('\n' + '='.repeat(68));
  console.log('💬 [WHATSAPP CORPORATIVO] DISPARO DE TOKEN OTP VIA WHATSAPP');
  console.log('='.repeat(68));
  console.log(`  👤 Destinatário:      ${nome || 'Colaborador'}`);
  console.log(`  📞 WhatsApp:          +55 ${maskedPhone} (${waNumber})`);
  console.log(`  🔒 Exibição Segura:   ${maskedPhone}`);
  console.log(`  🔑 Código OTP (6 dig): \x1b[1m\x1b[32m${otp}\x1b[0m`);
  console.log(`  ⏱️  Validade:          ${expiresInMinutes} minutos`);
  console.log(`  📲 Link Direto wa.me: ${waMeUrl}`);
  console.log('='.repeat(68) + '\n');

  return {
    success: true,
    provider: 'direct_whatsapp',
    messageId: record.id,
    maskedPhone,
    waMeUrl
  };
}

/**
 * Obtém o último disparo registrado no histórico para testes
 */
export function getLastWhatsappForPhone(phone) {
  const wa = formatWhatsAppNumber(phone);
  return [...whatsappHistory].reverse().find(w => w.waNumber === wa || w.telefoneOriginal === phone);
}
