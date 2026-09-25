import { auth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const loadingState = document.getElementById('loading-state');
  const invalidTokenState = document.getElementById('invalid-token-state');
  const invalidTokenMsg = document.getElementById('invalid-token-msg');
  const successState = document.getElementById('success-state');
  const resetForm = document.getElementById('reset-password-form');
  const pageSubtitle = document.getElementById('page-subtitle');

  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const userInitial = document.getElementById('user-initial');

  const errorAlert = document.getElementById('error-alert');
  const errorMsg = document.getElementById('error-msg');

  const novaSenhaInput = document.getElementById('nova-senha');
  const confirmarNovaSenhaInput = document.getElementById('confirmar-nova-senha');
  const btnToggleSenha = document.getElementById('btn-toggle-senha');
  const btnToggleConfirmar = document.getElementById('btn-toggle-confirmar');
  const btnSubmitReset = document.getElementById('btn-submit-reset');

  const ruleLength = document.getElementById('rule-length');
  const ruleContext = document.getElementById('rule-context');
  const rulePatterns = document.getElementById('rule-patterns');
  const ruleCommon = document.getElementById('rule-common');
  const ruleMatch = document.getElementById('rule-match');

  let currentUserContext = {};

  // Toggle visualização de senhas
  if (btnToggleSenha && novaSenhaInput) {
    btnToggleSenha.addEventListener('click', () => {
      const isPass = novaSenhaInput.type === 'password';
      novaSenhaInput.type = isPass ? 'text' : 'password';
      btnToggleSenha.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  if (btnToggleConfirmar && confirmarNovaSenhaInput) {
    btnToggleConfirmar.addEventListener('click', () => {
      const isPass = confirmarNovaSenhaInput.type === 'password';
      confirmarNovaSenhaInput.type = isPass ? 'text' : 'password';
      btnToggleConfirmar.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  // Se não houver token na URL
  if (!token) {
    loadingState.style.display = 'none';
    invalidTokenMsg.textContent = 'Nenhum código de redefinição foi fornecido. Por favor, acesse o link enviado para o seu e-mail corporativo.';
    invalidTokenState.style.display = 'block';
    return;
  }

  // Valida o token junto à API
  try {
    const check = await auth.validateResetToken(token);
    currentUserContext = check || {};
    
    if (userName) userName.textContent = check.nome || 'Colaborador';
    if (userEmail) userEmail.textContent = check.email_mascarado || 'e-mail cadastrado';
    if (userInitial) userInitial.textContent = (check.nome || 'U').charAt(0).toUpperCase();
    if (pageSubtitle) pageSubtitle.textContent = `Olá, ${check.nome || 'Colaborador'}. Defina sua nova senha.`;

    loadingState.style.display = 'none';
    resetForm.style.display = 'block';
    novaSenhaInput.focus();
  } catch (err) {
    loadingState.style.display = 'none';
    invalidTokenMsg.textContent = err.message || 'Este link de redefinição expirou ou não é válido. Solicite um novo link.';
    invalidTokenState.style.display = 'block';
    return;
  }

  // Validação dinâmica em tempo real das regras de senha (NIST SP 800-63B)
  const WEAK_WORDS = ['123456789', 'password', 'senha123', 'admin123', 'trocar123', 'mudar123', 'elevador', 'tkelevator', 'orcamento'];

  function checkPasswordRules() {
    const pass = (novaSenhaInput.value || '').trim();
    const confirm = (confirmarNovaSenhaInput.value || '').trim();
    const lowerPass = pass.toLowerCase();

    // 1. Mínimo 9 caracteres
    const validLength = pass.length >= 9;

    // 2. Sem dados pessoais
    let validContext = true;
    if (currentUserContext.nome) {
      const parts = currentUserContext.nome.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
      for (const p of parts) {
        if (lowerPass.includes(p)) validContext = false;
      }
    }
    if (currentUserContext.email) {
      const emailUser = currentUserContext.email.split('@')[0].toLowerCase();
      const parts = emailUser.split(/[._-]/).filter(p => p.length >= 3);
      for (const p of parts) {
        if (lowerPass.includes(p)) validContext = false;
      }
    }
    if (currentUserContext.matricula && lowerPass.includes(String(currentUserContext.matricula).toLowerCase())) {
      validContext = false;
    }

    // 3. Sem repetições excessivas ou sequências óbvias
    let validPatterns = true;
    if (/(.)\1{3,}/.test(pass)) validPatterns = false;
    const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl'];
    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 4; i++) {
        if (lowerPass.includes(seq.substring(i, i + 4))) validPatterns = false;
      }
    }

    // 4. Sem senhas comuns / dicionário
    let validCommon = true;
    for (const w of WEAK_WORDS) {
      if (lowerPass.includes(w)) validCommon = false;
    }

    // 5. Coincidência
    const validMatch = pass.length > 0 && pass === confirm;

    // Atualiza indicadores visuais
    if (ruleLength) {
      ruleLength.style.color = validLength ? '#059669' : '#9CA3AF';
      ruleLength.querySelector('i').className = validLength ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }
    if (ruleContext) {
      ruleContext.style.color = (pass.length > 0 && validContext) ? '#059669' : '#9CA3AF';
      ruleContext.querySelector('i').className = (pass.length > 0 && validContext) ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }
    if (rulePatterns) {
      rulePatterns.style.color = (pass.length > 0 && validPatterns) ? '#059669' : '#9CA3AF';
      rulePatterns.querySelector('i').className = (pass.length > 0 && validPatterns) ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }
    if (ruleCommon) {
      ruleCommon.style.color = (pass.length > 0 && validCommon) ? '#059669' : '#9CA3AF';
      ruleCommon.querySelector('i').className = (pass.length > 0 && validCommon) ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }
    if (ruleMatch) {
      ruleMatch.style.color = validMatch ? '#059669' : '#9CA3AF';
      ruleMatch.querySelector('i').className = validMatch ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }

    return validLength && validContext && validPatterns && validCommon && validMatch;
  }


  novaSenhaInput.addEventListener('input', checkPasswordRules);
  confirmarNovaSenhaInput.addEventListener('input', checkPasswordRules);

  // Submissão da nova senha
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';

    const novaSenha = novaSenhaInput.value;
    const confirmarNovaSenha = confirmarNovaSenhaInput.value;

    if (!checkPasswordRules()) {
      errorMsg.textContent = 'Certifique-se de que a nova senha atende a todos os requisitos de segurança e coincide com a confirmação.';
      errorAlert.style.display = 'block';
      return;
    }

    btnSubmitReset.disabled = true;
    btnSubmitReset.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> <span>Salvando nova senha...</span>';

    try {
      await auth.resetPassword(token, novaSenha, confirmarNovaSenha);
      
      resetForm.style.display = 'none';
      successState.style.display = 'block';

      // Redirecionamento automático suave após 3 segundos
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3500);

    } catch (err) {
      errorMsg.textContent = err.message || 'Erro ao redefinir senha.';
      errorAlert.style.display = 'block';
      btnSubmitReset.disabled = false;
      btnSubmitReset.innerHTML = '<i class="bi bi-shield-check" style="margin-right: 0.35rem;"></i> <span>Salvar Nova Senha</span>';
    }
  });
});
