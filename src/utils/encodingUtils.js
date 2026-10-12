/**
 * Utilitários de codificação UTF-8 e padronização dos níveis de técnicos
 */

export const TECNICO_NIVEIS = Object.freeze(['Preventivo', 'Corretivo', 'Residente']);

/**
 * Corrige strings corrompidas por dupla codificação UTF-8 / Mojibake (ex: 'TÃ©cnico' -> 'Técnico', 'ManutenÃ§Ã£o' -> 'Manutenção')
 * @param {string} str
 * @returns {string}
 */
export function sanitizeUtf8(str) {
  if (typeof str !== 'string' || !str) return str;

  // Detecta sequências típicas de mojibake (caracteres 0xC2 ou 0xC3 seguidos de bytes de continuação)
  if (/(Ã[\u0080-\u00BF]|Â[\u0080-\u00BF])/.test(str)) {
    try {
      const fixed = Buffer.from(str, 'latin1').toString('utf8');
      if (!/[\uFFFD]/.test(fixed)) {
        return fixed;
      }
    } catch {}
  }

  return str;
}

/**
 * Padroniza a função do técnico para existir EXCLUSIVAMENTE um dos três níveis oficiais:
 * - 'Preventivo'
 * - 'Corretivo'
 * - 'Residente'
 * Qualquer outra classificação (como 'Técnico Master', 'Técnico Especialista', 'Técnico de Manutenção') é convertida.
 * @param {string} rawFuncao
 * @returns {'Preventivo' | 'Corretivo' | 'Residente'}
 */
export function normalizeTecnicoFuncao(rawFuncao) {
  const clean = sanitizeUtf8(String(rawFuncao || '').trim());
  const norm = clean.toLowerCase();

  if (norm.includes('resid')) {
    return 'Residente';
  }

  if (
    norm.includes('corr') ||
    norm.includes('repar') ||
    norm.includes('instal') ||
    norm.includes('especial') ||
    norm.includes('master')
  ) {
    return 'Corretivo';
  }

  // Padrão corporativo TKE para manutenção e preventivo
  return 'Preventivo';
}

/**
 * Sanitiza recursivamente todas as strings de um objeto ou array
 * @param {any} val
 * @returns {any}
 */
export function sanitizeDeep(val) {
  if (typeof val === 'string') {
    return sanitizeUtf8(val);
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeDeep);
  }
  if (val !== null && typeof val === 'object' && !(val instanceof Date) && !(val instanceof Buffer)) {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeDeep(v);
    }
    return res;
  }
  return val;
}
