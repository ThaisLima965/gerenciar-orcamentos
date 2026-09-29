import { generateSecret, generateURI, verifySync, generateSync } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

const ISSUER_NAME = 'TKE Orçamentos';

/**
 * Gera um novo segredo TOTP Base32 e o respectivo QR Code para pareamento
 * @param {string} email E-mail do usuário
 * @param {string} [nome] Nome do usuário para exibição
 * @returns {Promise<{ secret: string, manualKey: string, otpauthUrl: string, qrCodeDataUrl: string }>}
 */
export async function generateTotpSetup(email, nome = '') {
  const secret = generateSecret(); // Base32
  const label = email || nome || 'Colaborador';
  const otpauthUrl = generateURI({
    issuer: ISSUER_NAME,
    label: label,
    secret: secret
  });

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 260,
    color: {
      dark: '#111827',
      light: '#FFFFFF'
    }
  });

  // Formata chave textual em blocos legíveis de 4 caracteres (ex: JBSW Y3DP EHPK 3PXP)
  const manualKey = secret.match(/.{1,4}/g)?.join(' ') || secret;

  return {
    secret,
    manualKey,
    otpauthUrl,
    qrCodeDataUrl
  };
}

/**
 * Valida um token de 6 dígitos contra o segredo TOTP do usuário
 * @param {string} token Código de 6 dígitos digitado pelo usuário
 * @param {string} secret Segredo Base32 do usuário
 * @returns {boolean}
 */
export function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  const cleanToken = String(token).replace(/\D/g, '').trim();
  if (cleanToken.length !== 6) return false;

  try {
    const res = verifySync({
      token: cleanToken,
      secret: String(secret).replace(/\s+/g, '')
    });
    return Boolean(res && res.valid);
  } catch (err) {
    console.error('❌ [TOTP Service] Erro ao validar token TOTP:', err.message);
    return false;
  }
}

/**
 * Gera um conjunto de Códigos de Backup (Recuperação) estáticos de uso único
 * Formato: 8 caracteres (XXXX-XXXX)
 * @param {number} [count=8] Quantidade de códigos
 * @returns {{ rawCodes: string[], hashedCodes: string[] }}
 */
export function generateBackupCodes(count = 8) {
  const rawCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    // 8 caracteres alfanuméricos legíveis
    const bytes = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
    const formatted = `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`;
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');

    rawCodes.push(formatted);
    hashedCodes.push(hash);
  }

  return {
    rawCodes,
    hashedCodes
  };
}

/**
 * Valida e consome um código de backup
 * @param {string} inputCode Código digitado pelo usuário
 * @param {string[]|string} storedHashedCodes Array de hashes ou JSON string
 * @returns {{ valid: boolean, remainingHashes: string[] }}
 */
export function verifyAndConsumeBackupCode(inputCode, storedHashedCodes) {
  if (!inputCode || !storedHashedCodes) {
    return { valid: false, remainingHashes: [] };
  }

  let hashes = [];
  if (typeof storedHashedCodes === 'string') {
    try {
      hashes = JSON.parse(storedHashedCodes);
    } catch {
      hashes = [];
    }
  } else if (Array.isArray(storedHashedCodes)) {
    hashes = [...storedHashedCodes];
  }

  // Normaliza o código de entrada
  const clean = String(inputCode).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length !== 8) {
    return { valid: false, remainingHashes: hashes };
  }
  const formattedInput = `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
  
  const cleanHash = crypto.createHash('sha256').update(clean).digest('hex');
  const formattedHash = crypto.createHash('sha256').update(formattedInput).digest('hex');

  let matchIndex = hashes.indexOf(cleanHash);
  if (matchIndex === -1) {
    matchIndex = hashes.indexOf(formattedHash);
  }

  if (matchIndex === -1) {
    return { valid: false, remainingHashes: hashes };
  }

  // Remove o código consumido da lista
  hashes.splice(matchIndex, 1);

  return {
    valid: true,
    remainingHashes: hashes
  };
}
