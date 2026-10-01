/**
 * Motor de Validação de Senhas em Conformidade Estrita com NIST SP 800-63B
 * (Digital Identity Guidelines - Authentication and Lifecycle Management)
 *
 * Critérios Obrigatórios:
 * 1. Comprimento: Mínimo obrigatório de 9 caracteres (idealmente 12+).
 * 2. Contexto Pessoal: Rejeita dados conhecidos do usuário (nome, sobrenome, e-mail, matrícula, username).
 * 3. Padrões Previsíveis: Rejeita repetições e sequências óbvias (ex: 'aaaaaa', '123456', 'qwerty').
 * 4. Vazamentos e Senhas Comuns: Rejeita senhas em listas de senhas fracas ou de dicionário comum.
 * 5. Diversidade e Entropia Global: Avalia entropia sem exigir regras artificiais obsoletas de caracteres.
 */

// Lista de palavras e sequências proibidas / vazadas mais comuns
const COMMON_WEAK_PASSWORDS = new Set([
  '123456789', '1234567890', '12345678', 'password123', 'password1', 'password',
  'senha1234', 'senha123', 'senhadificil', 'trocar123', 'mudar123', 'master123',
  'admin1234', 'admin123', 'administrador', 'suporte123', 'welcome123', 'welcome1',
  'iloveyou1', 'qwerty123', 'asdfgh123', 'zxcvbn123', 'tke12345', 'tkelevator',
  'elevador123', 'orcamento123', 'empresa123', 'brasil123', 'futebol123', 'temporaria123',
  'acesso123', 'provisoria123', 'sistema123', 'usuario123', 'default123'
]);

const SEQUENTIAL_PATTERNS = [
  '0123456789', '9876543210',
  'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba',
  'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
];

/**
 * Valida uma senha contra as diretrizes NIST SP 800-63B
 * @param {string} password - Senha a ser validada
 * @param {object} [userContext] - Dados do usuário para verificar contexto pessoal { nome, email, matricula }
 * @returns {{ isValid: boolean, errors: string[], score: number, feedback: string }}
 */
export function validatePasswordNIST(password, userContext = {}) {
  const errors = [];
  const rawPass = String(password || '');
  const cleanPass = rawPass.trim();
  const lowerPass = cleanPass.toLowerCase();

  // 1. Comprimento: Mínimo 9 caracteres
  if (cleanPass.length < 9) {
    errors.push('A senha deve conter no mínimo 9 caracteres (recomendado 12 ou mais).');
  }

  // 2. Contexto Pessoal: Não conter nome, e-mail ou matrícula
  if (userContext) {
    const { nome, email, matricula } = userContext;

    if (matricula && String(matricula).trim().length >= 4) {
      const mat = String(matricula).trim().toLowerCase();
      if (lowerPass.includes(mat)) {
        errors.push('A senha não deve conter sua matrícula funcional.');
      }
    }

    if (email && typeof email === 'string' && email.includes('@')) {
      const emailUser = email.split('@')[0].toLowerCase();
      // Verifica partes do e-mail separadas por ponto, traço ou underline com mais de 3 caracteres
      const emailParts = emailUser.split(/[._-]/).filter(p => p.length >= 3);
      for (const part of emailParts) {
        if (lowerPass.includes(part)) {
          errors.push(`A senha não deve conter partes do seu e-mail corporativo ("${part}").`);
          break;
        }
      }
    }

    if (nome && typeof nome === 'string') {
      const nameParts = nome.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
      for (const part of nameParts) {
        if (lowerPass.includes(part)) {
          errors.push(`A senha não deve conter derivações do seu nome ("${part}").`);
          break;
        }
      }
    }
  }

  // 3. Padrões Previsíveis: Repetições consecutivas (ex: aaaaa, 11111)
  if (/(.)\1{3,}/.test(cleanPass)) {
    errors.push('A senha não deve conter repetições excessivas do mesmo caractere consecutivo.');
  }

  // Sequências óbvias de teclado ou alfabeto (ex: 12345, abcde, qwerty)
  for (const seq of SEQUENTIAL_PATTERNS) {
    for (let i = 0; i <= seq.length - 4; i++) {
      const subSeq = seq.substring(i, i + 4);
      if (lowerPass.includes(subSeq)) {
        errors.push(`A senha não deve conter sequências previsíveis do teclado ("${subSeq}").`);
        break;
      }
    }
  }

  // 4. Vazamentos e Senhas Comuns de Dicionário
  if (COMMON_WEAK_PASSWORDS.has(lowerPass)) {
    errors.push('Esta senha é muito comum ou sabidamente vulnerável. Escolha uma combinação mais segura.');
  }

  for (const weak of COMMON_WEAK_PASSWORDS) {
    if (weak.length >= 6 && lowerPass.includes(weak)) {
      errors.push(`A senha contém termos comuns de dicionário ("${weak}").`);
      break;
    }
  }

  // 5. Diversidade e Entropia Global
  let entropyScore = 0;
  if (cleanPass.length >= 9) entropyScore += 25;
  if (cleanPass.length >= 12) entropyScore += 25;
  if (cleanPass.length >= 16) entropyScore += 15;

  const hasLower = /[a-z]/.test(cleanPass);
  const hasUpper = /[A-Z]/.test(cleanPass);
  const hasDigit = /[0-9]/.test(cleanPass);
  const hasSpecial = /[^a-zA-Z0-9]/.test(cleanPass);

  const charTypesCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (charTypesCount >= 2) entropyScore += 15;
  if (charTypesCount >= 3) entropyScore += 15;
  if (charTypesCount === 4) entropyScore += 10;

  const isValid = errors.length === 0;

  let feedback = 'Excelente robustez (NIST SP 800-63B)';
  if (entropyScore < 50) feedback = 'Fraca';
  else if (entropyScore < 75) feedback = 'Média';
  else if (entropyScore < 90) feedback = 'Forte';

  return {
    isValid,
    errors,
    score: Math.min(100, entropyScore),
    feedback: isValid ? feedback : (errors[0] || 'Senha não atende aos critérios NIST SP 800-63B.')
  };
}

/**
 * Gera uma Senha Provisória Segura que atende aos critérios do NIST SP 800-63B
 */
export function generateSecureProvisionalPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  let pass = '';
  // 4 letras
  for (let i = 0; i < 4; i++) pass += letters[Math.floor(Math.random() * letters.length)];
  // 1 símbolo
  pass += symbols[Math.floor(Math.random() * symbols.length)];
  // 4 números
  for (let i = 0; i < 4; i++) pass += numbers[Math.floor(Math.random() * numbers.length)];
  // 3 letras adicionais para totalizar 12 caracteres de alta entropia
  for (let i = 0; i < 3; i++) pass += letters[Math.floor(Math.random() * letters.length)];

  return pass;
}
