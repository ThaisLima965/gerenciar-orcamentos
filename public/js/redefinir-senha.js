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
  const ruleMixed = document.getElementById('rule-mixed');
  const ruleMatch = document.getElementById('rule-match');

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
  function updateRuleStatus(el, isValid) {
    if (isValid) {
      el.style.color = '#10B981';
      el.innerHTML = '<i class="bi bi-check-circle-fill" style="color: #10B981;"></i> ' + el.textContent.trim();
    } else {
      el.style.color = '#9CA3AF';
      el.innerHTML = '<i class="bi bi-circle" style="color: #9CA3AF;"></i> ' + el.textContent.trim();
    }
  }

  function checkPasswordRules() {
    const pass = novaSenhaInput.value;
    const confirm = confirmarNovaSenhaInput.value;

    const validLength = pass.length >= 8;
    const validMixed = /[a-zA-Z]/.test(pass) && /[0-9]/.test(pass);
    const validMatch = pass.length > 0 && pass === confirm;

    ruleLength.style.color = validLength ? '#059669' : '#9CA3AF';
    ruleLength.querySelector('i').className = validLength ? 'bi bi-check-circle-fill' : 'bi bi-circle';

    ruleMixed.style.color = validMixed ? '#059669' : '#9CA3AF';
    ruleMixed.querySelector('i').className = validMixed ? 'bi bi-check-circle-fill' : 'bi bi-circle';

    ruleMatch.style.color = validMatch ? '#059669' : '#9CA3AF';
    ruleMatch.querySelector('i').className = validMatch ? 'bi bi-check-circle-fill' : 'bi bi-circle';

    return validLength && validMixed && validMatch;
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
