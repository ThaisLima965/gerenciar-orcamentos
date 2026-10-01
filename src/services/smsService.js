import dotenv from 'dotenv';
dotenv.config();

/**
 * Histórico de SMS em memória para auditoria, testes e ambiente de desenvolvimento
 */
export const smsHistory = [];

/**
 * Normaliza qualquer número de telefone brasileiro para o padrão internacional E.164 (+55119XXXXXXXX)
 * @param {string|number} phone 
 * @returns {string} Telefone no formato E.164 (ex: +5511972238863)
 */
export function formatE164(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Se já possui código de país 55 (12 ou 13 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  // Se possui 10 ou 11 dígitos com DDD (ex: 11972238863)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  // Se possui 8 ou 9 dígitos sem DDD (ex: 972238863), assume DDD padrão 11
  if (digits.length === 8 || digits.length === 9) {
    const ddd11 = digits.length === 8 ? `9${digits}` : digits;
    return `+5511${ddd11}`;
  }

  // Fallback seguro
  return digits.startsWith('+') ? digits : `+55${digits}`;
}

/**
 * Mascara o número de telefone para exibição visual segura no frontend (ex: (11) 9****-8863)
 * @param {string} phone 
 * @returns {string} Telefone mascarado
 */
export function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // Pega os 11 dígitos padrão (com DDD)
  let cleanNumber = digits;
  if (cleanNumber.startsWith('55') && cleanNumber.length > 11) {
    cleanNumber = cleanNumber.substring(2);
  }

  if (cleanNumber.length < 10) {
    // Número muito curto, mascara central
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
 * Envia mensagem SMS contendo o token OTP de redefinição de senha
 * @param {Object} params
 * @param {string} params.nome Nome do colaborador
 * @param {string} params.telefone Telefone cadastrado no banco
 * @param {string} params.otp Código OTP de 6 dígitos
 * @param {number} [params.expiresInMinutes=10] Tempo de validade do token
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, maskedPhone: string }>}
 */
export async function sendResetOtpSms({ nome, telefone, otp, expiresInMinutes = 10 }) {
  const e164Phone = formatE164(telefone);
  const maskedPhone = maskPhone(telefone);
  const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();

  const messageText = `[TKE Orcamentos] Seu codigo de verificacao para redefinicao de senha e: ${otp}. Valido por ${expiresInMinutes} minutos. Nao compartilhe com ninguem.`;

  const smsRecord = {
    id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    nome,
    telefoneOriginal: telefone,
    telefoneE164: e164Phone,
    maskedPhone,
    otp,
    messageText,
    provider,
    status: 'SENT',
    sentAt: new Date().toISOString()
  };

  // Provedor Twilio
  if (provider === 'twilio' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      const bodyParams = new URLSearchParams({
        To: e164Phone,
        From: fromNumber,
        Body: messageText
      });

      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams.toString()
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Erro Twilio ${response.status}`);
      }

      smsRecord.messageId = data.sid;
      smsRecord.status = 'DELIVERED_TWILIO';
      smsHistory.push(smsRecord);

      console.log(`📱 [SMS Service: Twilio] SMS enviado com sucesso para ${maskedPhone} (SID: ${data.sid})`);
      return { success: true, provider: 'twilio', messageId: data.sid, maskedPhone };
    } catch (err) {
      console.error('❌ [SMS Service: Twilio] Erro ao enviar SMS via Twilio:', err.message);
    }
  }

  // Provedor Zenvia
  if (provider === 'zenvia' && process.env.ZENVIA_API_TOKEN) {
    try {
      const zenviaToken = process.env.ZENVIA_API_TOKEN;
      const zenviaFrom = process.env.ZENVIA_FROM || 'TKE';

      const response = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
        method: 'POST',
        headers: {
          'X-API-TOKEN': zenviaToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: zenviaFrom,
          to: e164Phone.replace('+', ''),
          contents: [{ type: 'text', text: messageText }]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Erro Zenvia ${response.status}`);
      }

      smsRecord.messageId = data.id;
      smsRecord.status = 'DELIVERED_ZENVIA';
      smsHistory.push(smsRecord);

      console.log(`📱 [SMS Service: Zenvia] SMS enviado com sucesso para ${maskedPhone} (ID: ${data.id})`);
      return { success: true, provider: 'zenvia', messageId: data.id, maskedPhone };
    } catch (err) {
      console.error('❌ [SMS Service: Zenvia] Erro ao enviar SMS via Zenvia:', err.message);
    }
  }

  // Provedor Padrão de Desenvolvimento / Simulado (Console Mock)
  smsHistory.push(smsRecord);

  console.log('\n' + '='.repeat(68));
  console.log('📱 [SMS GATEWAY CORPORATIVO] DISPARO DE TOKEN SMS (OTP)');
  console.log('='.repeat(68));
  console.log(`  👤 Destinatário:      ${nome || 'Colaborador'}`);
  console.log(`  📞 Telefone (E.164):  ${e164Phone}`);
  console.log(`  🔒 Exibição Segura:   ${maskedPhone}`);
  console.log(`  🔑 Código OTP (6 dig): \x1b[1m\x1b[32m${otp}\x1b[0m`);
  console.log(`  ⏱️  Validade:          ${expiresInMinutes} minutos`);
  console.log(`  💬 Mensagem:          "${messageText}"`);
  console.log('='.repeat(68) + '\n');

  return {
    success: true,
    provider: 'console_mock',
    messageId: smsRecord.id,
    maskedPhone
  };
}

/**
 * Obtém o último SMS disparado para um determinado telefone (útil para testes e debug)
 */
export function getLastSmsForPhone(phone) {
  const e164 = formatE164(phone);
  return [...smsHistory].reverse().find(s => s.telefoneE164 === e164 || s.telefoneOriginal === phone);
}
